"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Search,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StatusCode {
  code: number;
  name: string;
  description: string;
  whenToUse: string;
  example: string;
}

interface Category {
  range: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  codes: StatusCode[];
}

/* ------------------------------------------------------------------ */
/*  Data — every standard HTTP status code                             */
/* ------------------------------------------------------------------ */

const CATEGORIES: Category[] = [
  {
    range: "1xx",
    label: "Informational",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    badgeBg: "bg-blue-500/20",
    codes: [
      { code: 100, name: "Continue", description: "The server has received the request headers and the client should proceed to send the request body.", whenToUse: "When sending a large request body and the server needs to confirm it will accept it before the client sends the full payload.", example: "A client sends an Expect: 100-continue header before uploading a 2GB file. The server responds 100 to confirm." },
      { code: 101, name: "Switching Protocols", description: "The server is switching to the protocol the client requested via an Upgrade header.", whenToUse: "When upgrading an HTTP connection to WebSocket or HTTP/2.", example: "A browser sends an Upgrade: websocket header and the server responds 101 before switching to the WebSocket protocol." },
      { code: 102, name: "Processing", description: "The server has received and is processing the request, but no response is available yet.", whenToUse: "When a WebDAV request takes a long time and the client needs to know the server hasn't timed out.", example: "A WebDAV COPY operation on a large directory tree sends 102 to prevent client timeout." },
      { code: 103, name: "Early Hints", description: "Used to return some response headers before the final HTTP message.", whenToUse: "When the server wants the client to start preloading resources while the final response is being prepared.", example: "The server sends 103 with Link: </style.css>; rel=preload so the browser starts fetching CSS before the HTML is ready." },
    ],
  },
  {
    range: "2xx",
    label: "Success",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/20",
    codes: [
      { code: 200, name: "OK", description: "The request succeeded. The meaning of success depends on the HTTP method used.", whenToUse: "The standard response for successful GET, PUT, PATCH, or DELETE requests.", example: "GET /api/users returns 200 with a JSON array of user objects." },
      { code: 201, name: "Created", description: "The request succeeded and a new resource was created as a result.", whenToUse: "After a POST request that creates a new resource. Include a Location header with the new resource URI.", example: "POST /api/users creates a new user and returns 201 with Location: /api/users/42." },
      { code: 202, name: "Accepted", description: "The request has been accepted for processing, but the processing has not been completed.", whenToUse: "When the server queues a request for async processing (e.g., batch jobs, email sending).", example: "POST /api/reports/generate queues a report job and returns 202 with a job ID for polling." },
      { code: 203, name: "Non-Authoritative Information", description: "The server successfully processed the request but is returning modified information from a third-party source.", whenToUse: "When a proxy modifies the response headers or body from the origin server.", example: "A CDN proxy returns 203 after stripping some headers from the origin response." },
      { code: 204, name: "No Content", description: "The server successfully processed the request but is not returning any content.", whenToUse: "After a successful DELETE or PUT when no response body is needed. Also useful for 'fire and forget' actions.", example: "DELETE /api/users/42 removes the user and returns 204 with no body." },
      { code: 205, name: "Reset Content", description: "The server successfully processed the request and asks the client to reset the document view.", whenToUse: "After processing a form submission when the client should clear the form.", example: "POST /api/feedback submits a form and returns 205, signaling the browser to clear all form fields." },
      { code: 206, name: "Partial Content", description: "The server is delivering only part of the resource due to a Range header sent by the client.", whenToUse: "When supporting resumable downloads or video streaming with byte-range requests.", example: "GET /video.mp4 with Range: bytes=0-1048575 returns 206 with the first 1MB chunk." },
      { code: 207, name: "Multi-Status", description: "A WebDAV response that conveys information about multiple resources where multiple status codes might be appropriate.", whenToUse: "When a single request affects multiple resources and each may have a different result.", example: "A WebDAV PROPFIND on a folder returns 207 with individual status for each file inside." },
      { code: 208, name: "Already Reported", description: "Used in a WebDAV DAV:propstat response to avoid repeatedly enumerating the internal members of multiple bindings to the same collection.", whenToUse: "When WebDAV binding members were already listed in a previous part of the multistatus response.", example: "A WebDAV response uses 208 to avoid listing the same files twice in a recursive collection report." },
      { code: 226, name: "IM Used", description: "The server has fulfilled a GET request and the response is a representation of the result of one or more instance-manipulations applied to the current instance.", whenToUse: "When using delta encoding to send only changes since the client's last request.", example: "The server returns 226 with a delta-encoded response containing only the changes since the client's last ETag." },
    ],
  },
  {
    range: "3xx",
    label: "Redirection",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    badgeBg: "bg-amber-500/20",
    codes: [
      { code: 300, name: "Multiple Choices", description: "The request has more than one possible response. The client should choose one of them.", whenToUse: "When a resource exists in multiple representations (e.g., different formats or languages).", example: "GET /document returns 300 with links to /document.pdf, /document.html, and /document.docx." },
      { code: 301, name: "Moved Permanently", description: "The URL of the requested resource has been changed permanently. The new URL is given in the response.", whenToUse: "When a resource has permanently moved to a new URL. Search engines will update their index.", example: "GET /old-page returns 301 with Location: /new-page. Browsers and search engines update bookmarks." },
      { code: 302, name: "Found", description: "The URI of the requested resource has been changed temporarily. The client should continue using the original URI.", whenToUse: "When a resource is temporarily available at a different URL (e.g., during maintenance).", example: "GET /dashboard returns 302 with Location: /maintenance during scheduled downtime." },
      { code: 303, name: "See Other", description: "The server sent this response to direct the client to get the requested resource at another URI with a GET request.", whenToUse: "After a POST submission to redirect the client to a result page (POST/Redirect/GET pattern).", example: "POST /api/orders creates an order and returns 303 with Location: /orders/42/confirmation." },
      { code: 304, name: "Not Modified", description: "Indicates that the resource has not been modified since the last request. The client can use its cached copy.", whenToUse: "When the client sends If-None-Match or If-Modified-Since and the resource hasn't changed.", example: "GET /style.css with If-None-Match: \"abc123\" returns 304 because the file hasn't changed." },
      { code: 307, name: "Temporary Redirect", description: "The server sends this to direct the client to the requested resource at another URI with the same method.", whenToUse: "Like 302, but guarantees the HTTP method will not change (important for POST redirects).", example: "POST /api/v1/data returns 307 with Location: /api/v2/data, and the client re-POSTs to the new URL." },
      { code: 308, name: "Permanent Redirect", description: "The resource has permanently moved and the client should use the new URI with the same HTTP method.", whenToUse: "Like 301, but guarantees the HTTP method will not change. Best for API endpoint migrations.", example: "POST /api/v1/users returns 308 with Location: /api/v2/users, preserving the POST method permanently." },
    ],
  },
  {
    range: "4xx",
    label: "Client Error",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    badgeBg: "bg-red-500/20",
    codes: [
      { code: 400, name: "Bad Request", description: "The server cannot process the request due to something perceived to be a client error (malformed syntax, invalid framing, etc.).", whenToUse: "When the request body is malformed, required fields are missing, or validation fails.", example: "POST /api/users with {\"email\": \"not-an-email\"} returns 400 with validation error details." },
      { code: 401, name: "Unauthorized", description: "The client must authenticate itself to get the requested response. Semantically means 'unauthenticated'.", whenToUse: "When the request lacks valid authentication credentials (no token, expired token, invalid token).", example: "GET /api/profile without an Authorization header returns 401 with WWW-Authenticate: Bearer." },
      { code: 402, name: "Payment Required", description: "Reserved for future use. Originally intended for digital payment systems.", whenToUse: "When access requires payment or a subscription. Some APIs use this for quota/billing issues.", example: "GET /api/premium-data returns 402 when the user's subscription has expired." },
      { code: 403, name: "Forbidden", description: "The client does not have access rights to the content. Unlike 401, the client's identity is known to the server.", whenToUse: "When the authenticated user doesn't have permission for the requested action.", example: "DELETE /api/users/1 by a non-admin user returns 403: insufficient permissions." },
      { code: 404, name: "Not Found", description: "The server cannot find the requested resource. The URL is not recognized or the resource doesn't exist.", whenToUse: "When a resource genuinely doesn't exist. Also sometimes used to hide 403 for security.", example: "GET /api/users/99999 returns 404 when no user with that ID exists in the database." },
      { code: 405, name: "Method Not Allowed", description: "The request method is known by the server but not supported by the target resource.", whenToUse: "When a valid endpoint is called with an unsupported HTTP method. Include an Allow header.", example: "DELETE /api/readonly-resource returns 405 with Allow: GET, HEAD." },
      { code: 406, name: "Not Acceptable", description: "The server cannot produce a response matching the list of acceptable values in the request's Accept headers.", whenToUse: "When the client requests a content type the server can't provide (e.g., Accept: application/xml on a JSON-only API).", example: "GET /api/data with Accept: application/xml returns 406 when only JSON is supported." },
      { code: 407, name: "Proxy Authentication Required", description: "Similar to 401 but authentication is needed with a proxy between the client and server.", whenToUse: "When a proxy requires the client to authenticate before forwarding the request.", example: "A corporate proxy returns 407 with Proxy-Authenticate: Basic to require employee credentials." },
      { code: 408, name: "Request Timeout", description: "The server timed out waiting for the request. The client did not produce a request within the expected time.", whenToUse: "When the server wants to close an idle connection because the client took too long to send the request.", example: "A client opens a connection but sends no data for 30 seconds; the server responds 408." },
      { code: 409, name: "Conflict", description: "The request conflicts with the current state of the server.", whenToUse: "When the request can't be completed due to a conflict with the resource's current state (e.g., duplicate entry, version mismatch).", example: "PUT /api/users/42 with an outdated ETag returns 409 due to a concurrent modification conflict." },
      { code: 410, name: "Gone", description: "The requested content has been permanently deleted from the server with no forwarding address.", whenToUse: "When a resource has been intentionally and permanently removed. Unlike 404, this signals the removal is deliberate.", example: "GET /api/deprecated-endpoint returns 410 to inform clients the endpoint was permanently removed." },
      { code: 411, name: "Length Required", description: "The server rejected the request because the Content-Length header is not defined and the server requires it.", whenToUse: "When the server needs to know the request body size upfront (e.g., for resource allocation).", example: "POST /api/upload without a Content-Length header returns 411." },
      { code: 412, name: "Precondition Failed", description: "The client has indicated preconditions in its headers which the server does not meet.", whenToUse: "When conditional headers like If-Match or If-Unmodified-Since evaluate to false.", example: "PUT /api/doc with If-Match: \"old-etag\" returns 412 because the document was updated by someone else." },
      { code: 413, name: "Payload Too Large", description: "The request entity is larger than limits defined by the server.", whenToUse: "When the request body exceeds the maximum size the server is willing to process.", example: "POST /api/upload with a 500MB file returns 413 when the server limit is 100MB." },
      { code: 414, name: "URI Too Long", description: "The URI requested by the client is longer than the server is willing to interpret.", whenToUse: "When a GET request URL is excessively long (e.g., huge query strings). Consider using POST instead.", example: "GET /search?q=... with a 10,000-character query string returns 414." },
      { code: 415, name: "Unsupported Media Type", description: "The media format of the requested data is not supported by the server.", whenToUse: "When the Content-Type of the request body is not supported by the endpoint.", example: "POST /api/data with Content-Type: text/plain returns 415 when the API expects application/json." },
      { code: 416, name: "Range Not Satisfiable", description: "The range specified by the Range header in the request cannot be fulfilled.", whenToUse: "When the client requests a byte range that exceeds the resource size.", example: "GET /file.zip with Range: bytes=999999999- returns 416 when the file is only 50MB." },
      { code: 417, name: "Expectation Failed", description: "The expectation given in the Expect header could not be met by the server.", whenToUse: "When the server cannot meet the Expect: 100-continue requirement.", example: "A request with Expect: 100-continue returns 417 because the server won't accept the upload." },
      { code: 418, name: "I'm a Teapot", description: "The server refuses the attempt to brew coffee with a teapot. An April Fools' joke from RFC 2324.", whenToUse: "As an Easter egg or to indicate a request that the server intentionally refuses to handle.", example: "GET /brew-coffee on a teapot-themed API returns 418 as a humorous response." },
      { code: 421, name: "Misdirected Request", description: "The request was directed at a server that is not able to produce a response.", whenToUse: "When an HTTP/2 connection is reused for a different origin that the server can't handle.", example: "A multiplexed HTTP/2 request intended for api.example.com hits cdn.example.com and gets 421." },
      { code: 422, name: "Unprocessable Entity", description: "The request was well-formed but the server was unable to process the contained instructions due to semantic errors.", whenToUse: "When the JSON/XML is syntactically valid but semantically incorrect (e.g., business rule violations).", example: "POST /api/orders with {\"quantity\": -5} returns 422: quantity must be positive." },
      { code: 423, name: "Locked", description: "The resource that is being accessed is locked.", whenToUse: "When a WebDAV resource is locked by another user or process.", example: "PUT /docs/report.docx returns 423 because another user has the file checked out." },
      { code: 424, name: "Failed Dependency", description: "The request failed because it depended on another request that failed.", whenToUse: "When a WebDAV method fails because a prerequisite action on another resource failed.", example: "A WebDAV COPY fails with 424 because the source file's LOCK validation returned an error." },
      { code: 425, name: "Too Early", description: "The server is unwilling to risk processing a request that might be replayed.", whenToUse: "When using TLS 1.3 early data (0-RTT) and the server wants to avoid replay attacks.", example: "A POST request sent as TLS 1.3 0-RTT data is rejected with 425 to prevent replays." },
      { code: 426, name: "Upgrade Required", description: "The server refuses to perform the request using the current protocol but might after the client upgrades.", whenToUse: "When the server requires the client to switch to a newer protocol (e.g., TLS, HTTP/2).", example: "An HTTP/1.0 request returns 426 with Upgrade: TLS/1.3, HTTP/2 to require a protocol upgrade." },
      { code: 428, name: "Precondition Required", description: "The origin server requires the request to be conditional to prevent lost updates.", whenToUse: "When the server requires If-Match or If-Unmodified-Since headers to prevent the 'lost update' problem.", example: "PUT /api/settings without an If-Match header returns 428, requiring optimistic concurrency control." },
      { code: 429, name: "Too Many Requests", description: "The user has sent too many requests in a given amount of time (rate limiting).", whenToUse: "When implementing rate limiting. Include Retry-After header to indicate when to try again.", example: "The API returns 429 with Retry-After: 60 after the client exceeds 100 requests per minute." },
      { code: 431, name: "Request Header Fields Too Large", description: "The server is unwilling to process the request because its header fields are too large.", whenToUse: "When request headers (especially cookies) exceed the server's size limits.", example: "A request with 32KB of cookies returns 431 when the server's header limit is 16KB." },
      { code: 451, name: "Unavailable For Legal Reasons", description: "The resource is unavailable due to legal demands (censorship, court order, etc.).", whenToUse: "When content is blocked due to legal requirements like DMCA takedowns or government censorship.", example: "GET /blocked-content returns 451 with a Link header pointing to the legal authority that demanded removal." },
    ],
  },
  {
    range: "5xx",
    label: "Server Error",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    badgeBg: "bg-purple-500/20",
    codes: [
      { code: 500, name: "Internal Server Error", description: "The server has encountered a situation it doesn't know how to handle.", whenToUse: "As a generic catch-all for unexpected server-side errors. Always log details server-side.", example: "An unhandled exception in the API handler returns 500 with a generic error message." },
      { code: 501, name: "Not Implemented", description: "The request method is not supported by the server and cannot be handled.", whenToUse: "When the server doesn't recognize the request method or lacks the ability to fulfill it.", example: "A PATCH request to a server that only supports GET and POST returns 501." },
      { code: 502, name: "Bad Gateway", description: "The server, while acting as a gateway or proxy, received an invalid response from the upstream server.", whenToUse: "When a reverse proxy or load balancer gets a bad response from the backend application server.", example: "Nginx returns 502 when the upstream Node.js app crashes and sends a malformed response." },
      { code: 503, name: "Service Unavailable", description: "The server is not ready to handle the request. Common causes include maintenance or overloading.", whenToUse: "During planned maintenance or when the server is overloaded. Include Retry-After header.", example: "The server returns 503 with Retry-After: 300 during a scheduled database migration." },
      { code: 504, name: "Gateway Timeout", description: "The server, acting as a gateway, did not receive a timely response from the upstream server.", whenToUse: "When a reverse proxy times out waiting for the backend to respond.", example: "Nginx returns 504 after waiting 60 seconds for a slow API endpoint that never responded." },
      { code: 505, name: "HTTP Version Not Supported", description: "The HTTP version used in the request is not supported by the server.", whenToUse: "When the client uses an HTTP version the server can't handle.", example: "A request using HTTP/3 returns 505 on a server that only supports HTTP/1.1 and HTTP/2." },
      { code: 506, name: "Variant Also Negotiates", description: "The server has an internal configuration error: transparent content negotiation results in a circular reference.", whenToUse: "When content negotiation is misconfigured and the chosen variant itself tries to negotiate.", example: "A misconfigured server where variant A points to variant B which points back to A returns 506." },
      { code: 507, name: "Insufficient Storage", description: "The server is unable to store the representation needed to complete the request.", whenToUse: "When the server runs out of disk space or storage quota for WebDAV operations.", example: "A WebDAV PUT fails with 507 because the server's storage quota has been exceeded." },
      { code: 508, name: "Loop Detected", description: "The server detected an infinite loop while processing the request.", whenToUse: "When a WebDAV request creates a binding loop (e.g., a folder containing itself).", example: "A WebDAV PROPFIND with Depth: infinity detects folder A links to folder B which links back to A." },
      { code: 510, name: "Not Extended", description: "Further extensions to the request are required for the server to fulfill it.", whenToUse: "When the server requires additional HTTP extensions that the client did not include.", example: "A request that requires a specific HTTP extension header returns 510 asking the client to add it." },
      { code: 511, name: "Network Authentication Required", description: "The client needs to authenticate to gain network access, typically from a captive portal.", whenToUse: "When a captive portal (hotel WiFi, airport) intercepts requests before granting internet access.", example: "A hotel WiFi captive portal returns 511 redirecting the user to a login page before allowing access." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HttpStatusPage() {
  const [search, setSearch] = useState("");
  const [expandedCode, setExpandedCode] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  /* Filter codes */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      codes: cat.codes.filter(
        (c) =>
          String(c.code).includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.codes.length > 0);
  }, [search]);

  const totalVisible = useMemo(() => filtered.reduce((s, c) => s + c.codes.length, 0), [filtered]);

  function toggleCategory(range: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(range)) next.delete(range);
      else next.add(range);
      return next;
    });
  }

  async function copyAsMarkdown(code: StatusCode) {
    const md = `## ${code.code} ${code.name}\n\n${code.description}\n\n**When to use:** ${code.whenToUse}\n\n**Example:** ${code.example}`;
    await navigator.clipboard.writeText(md);
    setCopied(code.code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Globe size={14} />
          <span className="text-sm font-semibold">HTTP Status Reference</span>
        </div>
        <span className="text-xs text-[var(--muted)] ml-1">
          {totalVisible} code{totalVisible !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] w-64"
          />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-20 text-[var(--muted)] text-sm">
            No status codes match your search.
          </div>
        )}

        {filtered.map((cat) => {
          const isCollapsed = collapsedCategories.has(cat.range);
          return (
            <section key={cat.range}>
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.range)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ${cat.bgColor} border ${cat.borderColor} text-left mb-2 hover:opacity-90 transition-opacity`}
              >
                {isCollapsed ? <ChevronRight size={14} className={cat.color} /> : <ChevronDown size={14} className={cat.color} />}
                <span className={`text-sm font-bold ${cat.color}`}>{cat.range}</span>
                <span className={`text-sm font-medium ${cat.color}`}>{cat.label}</span>
                <span className={`ml-auto text-xs ${cat.color} opacity-70`}>{cat.codes.length} code{cat.codes.length !== 1 ? "s" : ""}</span>
              </button>

              {/* Codes */}
              {!isCollapsed && (
                <div className="space-y-1.5 ml-1">
                  {cat.codes.map((code) => {
                    const isExpanded = expandedCode === code.code;
                    return (
                      <div key={code.code} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                        {/* Code row */}
                        <button
                          type="button"
                          onClick={() => setExpandedCode(isExpanded ? null : code.code)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <span className={`text-sm font-mono font-bold ${cat.color} w-10 flex-shrink-0`}>
                            {code.code}
                          </span>
                          <span className="text-sm font-medium text-[var(--foreground)] flex-shrink-0">
                            {code.name}
                          </span>
                          <span className="text-xs text-[var(--muted)] truncate ml-2 flex-1">
                            {code.description}
                          </span>
                          {isExpanded ? (
                            <ChevronDown size={13} className="text-[var(--muted)] flex-shrink-0" />
                          ) : (
                            <ChevronRight size={13} className="text-[var(--muted)] flex-shrink-0" />
                          )}
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 border-t border-[var(--border)] space-y-3">
                            <div>
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Description</h4>
                              <p className="text-xs text-[var(--foreground)] leading-relaxed">{code.description}</p>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">When to Use</h4>
                              <p className="text-xs text-[var(--foreground)] leading-relaxed">{code.whenToUse}</p>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Example Scenario</h4>
                              <p className="text-xs text-[var(--foreground)] leading-relaxed bg-[var(--background)] rounded-md px-3 py-2 border border-[var(--border)] font-mono">
                                {code.example}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); copyAsMarkdown(code); }}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] transition-colors"
                            >
                              {copied === code.code ? <Check size={11} /> : <Copy size={11} />}
                              {copied === code.code ? "Copied!" : "Copy as Markdown"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
