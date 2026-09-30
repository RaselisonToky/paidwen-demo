import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The app lives in a workspace: trace files from the repository root so the standalone build is complete.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
};

export default nextConfig;
