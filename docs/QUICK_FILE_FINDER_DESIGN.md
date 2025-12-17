# Quick File Finder - Design Document

## Overview

The Quick File Finder feature allows users to quickly navigate to any file in an OpenGrok project directly from the browser, similar to VS Code's "Go to File" (Ctrl+P) or GitHub's file finder (T key).

## Current Problems

The existing implementation has several issues:

1. **Broken API usage**: Attempts to use `/api/v1/search?full=*` which doesn't return a file listing
2. **Requires pre-browsing**: Falls back to scraping files from pages already visited
3. **Limited results**: Page scraping only captures files on currently viewed pages
4. **No real-time search**: Tries to pre-load all files then filter client-side

## Proposed Solution

Use OpenGrok's REST API endpoints properly:

- **Primary**: `/api/v1/search?path={query}&projects={project}` - Search file paths directly
- **Alternative**: `/api/v1/list?path=/` - List directory contents recursively (if needed)

### Architecture Change

**Before (broken):**
```
User types → Wait for full file list to load → Filter client-side → Show results
```

**After (proposed):**
```
User types → Debounced API call with search term → Server returns matching files → Show results
```

---

## Key Design Decisions

### Decision 1: Server-Side Search vs Client-Side Filtering

**Options considered:**

| Approach | Pros | Cons |
|----------|------|------|
| **A) Pre-load all files, filter client-side** | Fast filtering after load, works offline | Huge initial load time, memory intensive, OpenGrok has no "list all files" endpoint |
| **B) Search API per keystroke** | Always accurate, no memory overhead, works with any repo size | Requires network per search, potential rate limiting |
| **C) Hybrid: cache + search fallback** | Balances speed and accuracy | Complex logic, stale cache issues |

**Decision: Option B - Server-side search per keystroke (debounced)**

**Rationale:**
- OpenGrok's `/api/v1/search?path=...` endpoint is designed for exactly this purpose
- Works with repositories of any size (even millions of files)
- No "list all files" API exists in OpenGrok
- 300ms debounce prevents excessive API calls while maintaining responsiveness
- Similar to how GitHub's file finder works

---

### Decision 2: Search Parameter Strategy

**Options considered:**

| Approach | API Call | Behavior |
|----------|----------|----------|
| **A) Exact path match** | `path="usr/src/file.c"` | Only matches exact substring |
| **B) Wildcard prefix** | `path=*file*` | Matches anywhere in path |
| **C) Filename only** | `path=file.c` | OpenGrok searches intelligently |
| **D) Multiple terms** | `path=usr path=file` | AND search across path components |

**Decision: Option B - Wildcard wrapping (`*{query}*`)**

**Rationale:**
- Users typically type partial filenames or directory fragments
- Wrapping with wildcards (`*query*`) ensures matches anywhere in the path
- Matches user expectation from tools like VS Code's Ctrl+P
- Example: typing "main" matches `/src/main.c`, `/lib/domain/main.js`, `/main/app.ts`

**Implementation:**
```javascript
const searchUrl = `${baseUrl}/api/v1/search?path=*${encodeURIComponent(query)}*&projects=${project}&maxresults=50`;
```

---

### Decision 3: Result Presentation and Navigation

**Options considered:**

| Approach | Display | Click Action |
|----------|---------|--------------|
| **A) Full path only** | `/usr/src/lib/file.c` | Navigate to OpenGrok page |
| **B) Filename + directory** | `file.c` (in usr/src/lib) | Navigate + highlight match |
| **C) Filename highlighted** | `fi**le**.c` | Navigate to OpenGrok, option to open in VS Code |

**Decision: Option C - Highlighted filename with dual-action**

**Rationale:**
- Highlight matching characters helps users confirm the right file
- Primary click: Navigate to file in OpenGrok (stays in browser context)
- Secondary action (Shift+Enter or button): Open directly in VS Code via existing integration
- Consistent with the extension's core purpose of bridging OpenGrok ↔ VS Code

**Display format:**
```
main.c                    ← Filename with highlighted match
/usr/src/uts/common/os    ← Directory path (dimmed)
```

---

## Implementation Details

### API Integration

```javascript
async function searchFiles(project, query) {
  const baseUrl = getBaseUrl();
  const searchUrl = `${baseUrl}/api/v1/search?` + new URLSearchParams({
    path: `*${query}*`,
    projects: project,
    maxresults: '50'
  });

  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  // Results are keyed by file path
  return Object.keys(data.results || {});
}
```

### Debouncing

```javascript
let searchTimeout = null;

function onSearchInput(query) {
  clearTimeout(searchTimeout);

  if (query.length < 2) {
    showEmptyState('Type at least 2 characters');
    return;
  }

  showLoadingState();

  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchFiles(currentProject, query);
      displayResults(results, query);
    } catch (error) {
      showErrorState(error.message);
    }
  }, 300); // 300ms debounce
}
```

### Result Display

```javascript
function displayResults(files, query) {
  const resultsDiv = document.querySelector('.vscode-finder-results');

  if (files.length === 0) {
    resultsDiv.innerHTML = '<div class="vscode-finder-empty">No matching files</div>';
    return;
  }

  resultsDiv.innerHTML = files.map((file, index) => {
    const filename = file.split('/').pop();
    const directory = file.substring(0, file.lastIndexOf('/')) || '/';
    const highlighted = highlightMatch(filename, query);

    return `
      <div class="vscode-finder-result${index === 0 ? ' selected' : ''}"
           data-path="${escapeHtml(file)}">
        <div class="vscode-finder-filename">${highlighted}</div>
        <div class="vscode-finder-directory">${escapeHtml(directory)}</div>
      </div>
    `;
  }).join('');
}
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Open in OpenGrok |
| `Shift+Enter` | Open in VS Code |
| `Escape` | Close finder |

---

## Error Handling

| Scenario | User Feedback |
|----------|---------------|
| API returns 404 | "File search not available on this OpenGrok instance" |
| API returns 401/403 | "Authentication required for file search" |
| Network timeout | "Search timed out - try again" |
| No results | "No matching files found" |
| Query too short | "Type at least 2 characters to search" |

---

## Fallback Strategy

If the `/api/v1/search?path=...` endpoint is unavailable (older OpenGrok versions):

1. Display message: "Quick file search requires OpenGrok REST API (v1.0+)"
2. Offer link to navigate manually via OpenGrok's web interface
3. Do NOT fall back to page scraping (unreliable, sets wrong expectations)

---

## Future Enhancements (Out of Scope)

- Recent files list (stored locally)
- Fuzzy matching algorithm (fzf-style)
- File type filtering (*.c, *.h, etc.)
- Cross-project search

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Data source** | Server-side search via `/api/v1/search?path=...` |
| **Search strategy** | Wildcard wrapping (`*query*`) for substring matching |
| **User interaction** | Debounced search (300ms), keyboard navigation, dual-action results |
| **Error handling** | Clear user feedback, no silent failures, no unreliable fallbacks |
