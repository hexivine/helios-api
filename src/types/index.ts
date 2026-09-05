import type { SessionUser } from '../auth/auth.js';

export interface AuthedRequest {
  user: SessionUser;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface Project {
  id: number;
  name: string;
  ownerId: string;
  orgId: string;
  region: string;
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface Deployment {
  id: string;
  projectId: number;
  status: 'queued' | 'building' | 'ready' | 'failed';
  commitSha: string;
  branch: string;
  triggeredBy: string;
  startedAt: string;
}

export interface ApiKey {
  id: number;
  projectId: number;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}