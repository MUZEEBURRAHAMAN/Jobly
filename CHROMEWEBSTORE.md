# Chrome Web Store Listing & Policy Compliance Guide — Hiring Radar

## Store Metadata

- **Extension Name**: Hiring Radar — Role-Based Job Alerts
- **Summary / Short Description**: Track 350+ target tech employers and receive proactive notifications when positions matching your role are published.
- **Category**: Productivity / Search Tools
- **Version**: 0.1.0
- **Last Updated**: 2026-09-25

---

## Detailed Description

Stop checking dozens of career pages every day. Hiring Radar is a role-first job intelligence tool that monitors career feeds from top tech companies and sends you notifications the moment a relevant opening is published.

### Key Features
- **Role-Based Targeting**: Focus on Product Design, Frontend Engineering, AI / ML, Product Management, or Fullstack roles.
- **Direct ATS Integration**: Connects directly to verified public ATS boards (Greenhouse, Ashby, Lever) for 100% direct application links with zero intermediary fluff.
- **Company Watchlist**: Follow target employers (e.g. OpenAI, Anthropic, Waymo, Stripe, Figma, Linear, Ramp, Notion, Datadog) and get alerted when new roles open.
- **Granular Filtering**: Filter by seniority (Junior, Mid, Senior, Lead/Staff), work mode (Remote Only), and custom inclusion/exclusion keywords.
- **Non-Intrusive Desktop Notifications**: Receive grouped alerts instead of notification spam.
- **Saved Shortlist**: Bookmark opportunities with one click and apply directly on the company's official career site.
- **Privacy-First & Zero-Cost**: Runs locally on your machine with no third-party data tracking.

---

## Permissions Justification (Chrome Web Store Review Compliant)

| Permission | Justification |
| :--- | :--- |
| `storage` | Required to persist user role preferences, saved job bookmarks, and local feed cache so data remains available offline. |
| `notifications` | Required to display native desktop alerts when new job openings matching user preferences are discovered. |
| `alarms` | Required to schedule periodic background sync intervals without keeping battery-draining background loops running continuously. |
| `host_permissions` (`http://127.0.0.1:8000/*`, `http://localhost:8000/*`) | Required for the extension to communicate with the local Hiring Radar Python engine on the user's laptop. |

---

## Chrome Web Store Policy Compliance Audit

Hiring Radar is built from the ground up to strictly comply with all **Chrome Web Store Developer Program Policies**:

| Policy Requirement | How Hiring Radar Complies |
| :--- | :--- |
| **Single Purpose Policy** | The extension has a single, well-defined purpose: job discovery and notification matching. It does not bundle unrelated features. |
| **Minimal Permissions Principle** | Only 3 core permissions requested (`storage`, `notifications`, `alarms`). **Zero invasive permissions** (NO `tabs`, NO `scripting`, NO `<all_urls>`, NO cookies, NO webRequest). |
| **No In-Browser Web Scraping** | The extension **never injects content scripts** into third-party sites (LinkedIn, Indeed, Google, etc.). All job data is fetched on the backend via official, public ATS APIs. |
| **No Remote Code Execution (Manifest V3)** | 100% of executable JavaScript is bundled inside the extension package. Zero `eval()`, zero `new Function()`, zero external `<script>` loading. Strict CSP enforced: `script-src 'self'`. |
| **User Data & Privacy Policy** | **Zero personal data collected**. No resumes, browsing history, email addresses, or IP addresses are harvested or sold to third parties or data brokers. |
| **Transparent Disclosures** | All permissions have written, plain-English justifications ready to paste into the Chrome Developer Dashboard. |

---

## Privacy Policy & Data Use Disclosures

- **Personal Information Collected**: None. The extension does not collect resumes, browsing history, email addresses, or personal identifiable data.
- **Data Transmission**: Preferences and saved jobs are stored locally on the user's device and shared only with the user's local backend API.
- **Third-Party Sharing**: No data is sold, rented, or transferred to third parties or advertising networks.

---

## Version History

- **0.1.0** (September 2026): Production-ready release with 350+ verified tech employers across Greenhouse, Ashby, Lever, and verified remote feeds. Over 20,000 active roles tracked. Fully Manifest V3 compliant with minimal permissions architecture.
