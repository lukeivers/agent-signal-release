declare namespace Cloudflare {
  interface Env {
    REPORTING_ENABLED?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
