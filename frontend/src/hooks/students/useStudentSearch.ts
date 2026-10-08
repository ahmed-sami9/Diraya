import { useEffect, useState } from 'react';

import { searchStudents, type StudentSearchResult } from '../../api/students/students';
import { isAbortError } from '../../api/apiClient';

// Searching starts at this many characters. One letter matches almost every
// student, which is slow and not useful.
export const MIN_SEARCH_LENGTH = 2;

// Wait this long after the last keystroke before asking the server, so typing
// "Omar" sends one request instead of four.
const DEBOUNCE_MS = 250;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

// The answer the server gave, and the query it was for.
type SearchAnswer = {
  query: string;
  results: StudentSearchResult[];
  failed: boolean;
};

// Turns what the person types into search results.
//
//   - waits for a pause in typing (debounce)
//   - cancels a request that is no longer needed, so a slow answer for "Om"
//     can never replace a newer answer for "Omar"
//   - keeps the previous results visible while the next ones load
export function useStudentSearch(query: string) {
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);

  const trimmedQuery = query.trim();
  const isSearchable = trimmedQuery.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (!isSearchable) return;

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      searchStudents(trimmedQuery, controller.signal)
        .then((results) => setAnswer({ query: trimmedQuery, results, failed: false }))
        .catch((error: unknown) => {
          if (isAbortError(error)) return;

          console.error(error);
          setAnswer({ query: trimmedQuery, results: [], failed: true });
        });
    }, DEBOUNCE_MS);

    // Runs when the query changes again or the search box closes.
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, isSearchable]);

  // Worked out from the answer instead of stored, so it can never be out of
  // step with what was typed.
  const isCurrent = answer?.query === trimmedQuery;

  let status: SearchStatus = 'idle';

  if (isSearchable) {
    if (!isCurrent) status = 'loading';
    else status = answer.failed ? 'error' : 'ready';
  }

  return {
    status,
    // While loading, show the last results instead of an empty list.
    results: isSearchable ? (answer?.results ?? []) : [],
    query: trimmedQuery,
  };
}
