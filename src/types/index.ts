export interface Department {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position: string;
  department_id: string | null;
  supervisor_id: string | null;
  role: 'admin' | 'user';
  email: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  supervisor?: Profile;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  department_id: string | null;
  channel_type: 'department' | 'general' | 'announcements';
  created_at: string;
  department?: Department;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  joined_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}
