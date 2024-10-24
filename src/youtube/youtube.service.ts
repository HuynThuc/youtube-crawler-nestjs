import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ytdl from 'ytdl-core';
import * as ytpl from 'ytpl';
import * as fs from 'fs';
import * as path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { v4 as uuidv4 } from 'uuid';
import { VideoInfo } from './entities/video_info.entity';
import { PlaylistVideos } from './entities/playlist_video.entity'; // Đường dẫn tới entity VideoInfo

@Injectable()
export class YoutubeService {
  private proxyUrl: string;
  private readonly TEMP_DIR = 'static/temp';
  private readonly DELETE_AFTER_MS = 60000;
  private readonly RETRY_DELAY = 10000;
  private readonly MAX_RETRIES = 3;

  constructor(
    @InjectRepository(VideoInfo) // Tiêm VideoInfoRepository
    private videoInfoRepository: Repository<VideoInfo>,
    @InjectRepository(PlaylistVideos)
    private readonly playlistVideosRepository: Repository<PlaylistVideos>,
  ) {
    const proxyHost = process.env.PROXY_HOST;
    const proxyPort = process.env.PROXY_PORT;
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;
    this.proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;

    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  // Hàm để lấy thông tin video từ URL
  async getVideoInfo(url: string) {
    try {
      const info = await this.getVideoInfoWithRetry(url);
      const fileName = `${uuidv4()}.mp3`;
      const filePath = path.join(this.TEMP_DIR, fileName);

      const data = {
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        thumbnailUrl: info.videoDetails.thumbnails[0].url,
        blurThumbnailUrl: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
        duration: parseInt(info.videoDetails.lengthSeconds, 10),
        likeCount: info.videoDetails.likes,
        viewCount: parseInt(info.videoDetails.viewCount, 10),
        channel: {
          channelId: info.videoDetails.author.channel_url,
          channelName: info.videoDetails.author.name,
          channelAvatarImageUrl: info.videoDetails.author.thumbnails[0].url,
          channelDescription: info.videoDetails.ownerProfileUrl || '',
        },
        mp3_url: `${process.env.APP_URL || 'http://localhost:3000'}/${filePath}`,
        status: 'processing',
      };

      // Lưu thông tin video vào cơ sở dữ liệu
      await this.saveVideoInfo({
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        thumbnail_url: info.videoDetails.thumbnails[0].url,
        blur_thumbnail_url: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
        duration: parseInt(info.videoDetails.lengthSeconds, 10),
        like_count: info.videoDetails.likes,
        view_count: parseInt(info.videoDetails.viewCount, 10),
        channel_id: info.videoDetails.author.channel_url,
        channel_name: info.videoDetails.author.name,
        channel_avatar_url: info.videoDetails.author.thumbnails[0].url,
        channel_description: info.videoDetails.ownerProfileUrl || '',
        mp3_file_path: filePath,
        status: 'processing',
      });

      // Tiến hành tải MP3 trong background
      this.downloadAsMp3(url, filePath)
        .then(() => {
          console.log(`Download completed for ${filePath}`);
        })
        .catch(error => {
          console.error(`Download failed for ${filePath}:`, error);
        });

      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      }, this.DELETE_AFTER_MS);

      return data;
    } catch (error) {
      console.error('Error fetching video info:', error);
      throw new HttpException(
        error.message || 'Failed to fetch video info',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Hàm lưu thông tin video vào cơ sở dữ liệu
  private async saveVideoInfo(videoData: Partial<VideoInfo>): Promise<VideoInfo> {
    const videoInfo = this.videoInfoRepository.create(videoData);
    return this.videoInfoRepository.save(videoInfo);
  }

  // Hàm thêm retry logic để lấy thông tin video
  private async getVideoInfoWithRetry(url: string, attempt = 1): Promise<ytdl.videoInfo> {
    try {
      return await ytdl.getBasicInfo(url); // Lấy thông tin cơ bản của video
    } catch (error) {
      // Nếu gặp lỗi rate limiting (429), thử lại với delay
      if (error.statusCode === 429 && attempt <= this.MAX_RETRIES) {
        console.log(`Rate limited, retrying in ${this.RETRY_DELAY / 1000} seconds... (Attempt ${attempt})`);
        await this.delay(this.RETRY_DELAY); // Chờ trước khi thử lại
        return this.getVideoInfoWithRetry(url, attempt + 1); // Thử lại lần nữa
      } else {
        throw error; // Nếu không phải lỗi 429 hoặc quá số lần retry, ném lỗi
      }
    }
  }

  // Hàm delay để tạo khoảng nghỉ giữa các lần request
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Hàm để tải MP3 từ video và lưu vào đường dẫn chỉ định
  private async downloadAsMp3(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = ytdl(url, {
        quality: 'highestaudio', // Chỉ tải âm thanh chất lượng cao nhất
        filter: 'audioonly', // Chỉ lấy phần âm thanh
      });

      // Lưu dữ liệu vào file MP3
      stream.pipe(fs.createWriteStream(outputPath))
        .on('finish', () => {
          console.log(`Downloaded and saved to ${outputPath}`);
          resolve(); // Hoàn thành download
        })
        .on('error', (error) => {
          console.error('Download error:', error);
          reject(new Error('Failed to download audio')); // Xử lý lỗi khi tải về
        });
    });
  }

  // Hàm để lấy danh sách video từ playlist và lưu vào cơ sở dữ liệu
  async getVideosFromPlaylist(playlistUrl: string) {
    try {
      const playlist = await this.getPlaylistWithRetry(playlistUrl); // Lấy thông tin playlist với retry logic
      const videoPromises = playlist.items.map((item) => this.saveVideoFromPlaylist(item)); // Lưu từng video vào cơ sở dữ liệu

      await Promise.all(videoPromises); // Chờ tất cả các video được lưu thành công

      return {
        message: 'Videos saved successfully', // Trả về thông điệp thành công
      };
    } catch (error) {
      console.error('Error fetching playlist videos:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch playlist videos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Hàm lưu thông tin video từ playlist vào cơ sở dữ liệu
  private async saveVideoFromPlaylist(videoData: any): Promise<PlaylistVideos> {
    const playlistVideo = this.playlistVideosRepository.create({
      title: videoData.title,
      short_url: videoData.shortUrl,
    });
    return this.playlistVideosRepository.save(playlistVideo);
  }


  // Hàm retry logic khi lấy playlist gặp lỗi rate limiting
  private async getPlaylistWithRetry(playlistUrl: string, attempt = 1): Promise<ytpl.Result> {
    try {
      return await ytpl(playlistUrl, { requestOptions: { agent: new HttpsProxyAgent(this.proxyUrl) } }); // Lấy playlist với proxy
    } catch (error) {
      // Nếu gặp lỗi rate limiting (429), thử lại
      if (error.statusCode === 429 && attempt <= this.MAX_RETRIES) {
        console.log(`Rate limited on playlist, retrying in ${this.RETRY_DELAY / 1000} seconds... (Attempt ${attempt})`);
        await this.delay(this.RETRY_DELAY); // Chờ trước khi thử lại
        return this.getPlaylistWithRetry(playlistUrl, attempt + 1); // Thử lại lần nữa
      } else {
        throw error;
      }
    }
  }

  // Các phương thức khác không thay đổi...
}
