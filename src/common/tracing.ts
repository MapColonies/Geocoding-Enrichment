import { asyncCallWithSpan, callWithSpan, Tracing } from '@map-colonies/telemetry';
import { trace, type Span, type SpanOptions, type Tracer } from '@opentelemetry/api';
import { IGNORED_INCOMING_TRACE_ROUTES, IGNORED_OUTGOING_TRACE_ROUTES, SERVICE_NAME } from './constants';

const getServiceTracer = (): Tracer => trace.getTracer(SERVICE_NAME);

const tracing = new Tracing(undefined, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '@opentelemetry/instrumentation-http': {
    ignoreIncomingRequestHook: (request): boolean =>
      IGNORED_INCOMING_TRACE_ROUTES.some((route) => request.url !== undefined && route.test(request.url)),
    ignoreOutgoingRequestHook: (request): boolean =>
      IGNORED_OUTGOING_TRACE_ROUTES.some((route) => typeof request.path === 'string' && route.test(request.path)),
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '@opentelemetry/instrumentation-fs': {
    requireParentSpan: true,
  },
});

tracing.start();

export { tracing };

/**
 * Wraps an async function with a span. When tracing is disabled, fn runs unchanged and span is undefined.
 */
export const withSpan = async <T>(spanName: string, spanOptions: SpanOptions, fn: (span?: Span) => Promise<T>): Promise<T> =>
  asyncCallWithSpan(fn, getServiceTracer(), spanName, spanOptions);

/**
 * Wraps a sync function with a span. When tracing is disabled, fn runs unchanged and span is undefined.
 */
export const withSpanSync = <T>(spanName: string, spanOptions: SpanOptions, fn: (span?: Span) => T): T =>
  callWithSpan(fn, getServiceTracer(), spanName, spanOptions);
