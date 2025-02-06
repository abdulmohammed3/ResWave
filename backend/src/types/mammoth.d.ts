declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: any[];
  }

  interface Options {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(options: Options): Promise<ConversionResult>;
}
