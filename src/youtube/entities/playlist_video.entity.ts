import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('playlist_videos')
export class PlaylistVideos {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;  // Tiêu đề video

  @Column({ type: 'text', nullable: true })
  short_url: string;  // URL ngắn của video

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;  // Thời gian tạo
}
