export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailure = 0;

  constructor(
    private config = {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.timeout) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();
      this.handleSuccess();
      return result;
    } catch (err) {
      this.handleFailure();
      throw err;
    }
  }

  private handleSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    }
  }

  private handleFailure() {
    this.failures++;
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.lastFailure = Date.now();
    }
  }

  private reset() {
    this.failures = 0;
    this.successes = 0;
    this.state = 'closed';
  }
}

export class CircuitOpenError extends Error {
  constructor() {
    super('Service unavailable due to circuit breaker state');
  }
}
