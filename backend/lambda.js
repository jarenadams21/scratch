// Lambda Handler for AWS Lambda + API Gateway
// Wraps the existing server.js logic

import { handleRequest } from './server.js';
import serverlessHttp from 'serverless-http';
import http from 'http';

// Create a server instance for serverless-http to wrap
const server = http.createServer(handleRequest);

// Export Lambda handler
export const handler = serverlessHttp(server);
