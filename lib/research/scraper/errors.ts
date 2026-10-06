export class ScraperUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScraperUnavailableError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}
