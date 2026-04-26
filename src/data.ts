export interface Project {
  id: string;
  title: string;
  description: string;
  tech: string[];
  github?: string;
  demo?: string;
  image?: string;
}

export interface Skill {
  category: string;
  items: string[];
}

export interface Achievement {
  title: string;
  year: string;
  description: string;
}

export const PROJECTS: Project[] = [
  {
    id: "1",
    title: "School Management System",
    description: "A comprehensive platform to manage student records and academic performance, built for El-Sadat Secondary School.",
    tech: ["React", "Express", "Node.js", "PostgreSQL"],
    github: "https://github.com/yourusername/school-mgmt",
    demo: "https://demo.example.com",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "2",
    title: "E-Learning Portal",
    description: "An interactive learning portal with real-time quiz capabilities and resource sharing features.",
    tech: ["Next.js", "Firebase", "Tailwind CSS"],
    github: "https://github.com/yourusername/elearning",
    image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "3",
    title: "Eco-Tracker App",
    description: "A mobile-responsive web app to track carbon footsteps, winning 2nd place in the Regional STEM Fair.",
    tech: ["React Native", "TypeScript", "D3.js"],
    github: "https://github.com/yourusername/eco-tracker",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800"
  }
];

export const SKILLS: Skill[] = [
  {
    category: "Frontend",
    items: ["React", "Next.js", "Tailwind CSS", "TypeScript", "Motion"]
  },
  {
    category: "Backend",
    items: ["Node.js", "Express", "PostgreSQL", "MongoDB", "REST APIs"]
  },
  {
    category: "STEM & Tools",
    items: ["Python", "C++", "Git", "Docker", "Arduino"]
  }
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    title: "Top Rank - Mohamed Anwar El-Sadat Secondary School",
    year: "2025",
    description: "Consistently ranked in the top 3 students for academic excellence in Mathematics and Physics."
  },
  {
    title: "Regional STEM Competition Finalist",
    year: "2024",
    description: "Developed a renewable energy prototype for the National Science Fair."
  },
  {
    title: "Google Africa Developer Scholarship",
    year: "2024",
    description: "Completed advanced full-stack development certification."
  }
];
