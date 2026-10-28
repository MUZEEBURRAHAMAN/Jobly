export class AiError extends Error {
  constructor(message: string, readonly code: 'aborted' | 'auth' | 'other' = 'other') {
    super(message);
    this.name = 'AiError';
  }
}
