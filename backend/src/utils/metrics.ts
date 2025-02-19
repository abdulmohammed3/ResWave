interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: any;
}

const metricsQueue: Metric[] = [];

export function collectMetrics(name: string, value: number | object, tags?: Record<string, string>) {
  const metric: Metric = {
    name,
    value: typeof value === 'number' ? value : 0,
    timestamp: new Date(),
    tags,
    metadata: typeof value === 'object' ? value : undefined
  };
  
  metricsQueue.push(metric);
  flushMetricsIfNeeded();
}

function flushMetricsIfNeeded() {
  if (metricsQueue.length >= 100) {
    console.log('[Metrics] Flushing metrics:', metricsQueue);
    metricsQueue.length = 0;
  }
}

// Initialize metrics flushing on interval
setInterval(flushMetricsIfNeeded, 60000);