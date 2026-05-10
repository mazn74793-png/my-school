export type ProjectType = "project" | "image" | "video";
export type EducationLevel = "primary" | "preparatory" | "secondary" | "all";

export interface Project {
  id?: string;
  title: string;
  description: string;
  type: ProjectType;
  level: EducationLevel;
  mediaUrl: string;
  techStack?: string;
  createdAt: any;
  authorId: string;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  type: "info" | "urgent" | "event";
  createdAt: any;
}

export interface SiteSettings {
    schoolName: string;
    logoUrl: string;
    heroTitle: string;
    heroSubtitle: string;
    heroDescription: string;
    aboutTitle: string;
    aboutDescription: string;
    directorName: string;
    aboutImageUrl: string;
    directorVideoUrl?: string;
    directorPhotoUrl?: string;
}
