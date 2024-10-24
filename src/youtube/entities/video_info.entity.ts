import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('video_info')
export class VideoInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;  // Tiêu đề video

  @Column({ type: 'text', nullable: true })
  description: string;  // Mô tả video

  @Column({ type: 'text', nullable: true })
  thumbnail_url: string;  // Ảnh thumbnail của video

  @Column({ type: 'text', nullable: true })
  blur_thumbnail_url: string;  // Ảnh thumbnail mờ

  @Column({ type: 'int', nullable: true })
  duration: number;  // Thời lượng video (giây)

  @Column({ type: 'int', nullable: true })
  like_count: number;  // Số lượt thích

  @Column({ type: 'int', nullable: true })
  view_count: number;  // Số lượt xem

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_id: string;  // ID của kênh

  @Column({ type: 'varchar', length: 255, nullable: true })
  channel_name: string;  // Tên của kênh

  @Column({ type: 'text', nullable: true })
  channel_avatar_url: string;  // Ảnh đại diện của kênh

  @Column({ type: 'text', nullable: true })
  channel_description: string;  // Mô tả kênh

  @Column({ type: 'text', nullable: true })
  mp3_file_path: string;  // Đường dẫn file MP3

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;  // Trạng thái xử lý (processing, completed)

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;  // Thời gian tạo

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date;  // Thời gian xóa file
}
