export const config = {
  AWS_REGION:      process.env.AWS_REGION      || 'us-east-2',
  DYNAMODB_TABLE:  process.env.DYNAMODB_TABLE  || '',
  AUDIO_TABLE:     process.env.AUDIO_TABLE     || '',
  AUDIO_BUCKET:    process.env.AUDIO_BUCKET    || '',
  JWT_SECRET:      process.env.JWT_SECRET      || '',
  JWT_EXPIRES_IN:  process.env.JWT_EXPIRES_IN  || '7d',
  PORT:            process.env.PORT            || 3000,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
};
