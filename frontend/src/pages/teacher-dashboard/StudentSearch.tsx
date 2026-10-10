import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type { StudentSearchResult } from '../../api/students/students';
import SearchIcon from '../../components/icons/SearchIcon';
import { MIN_SEARCH_LENGTH, useStudentSearch } from '../../hooks/students/useStudentSearch';

interface StudentSearchProps {
  // Classes for the outer wrapper (width, visibility per screen size).
  className?: string;
  autoFocus?: boolean;
  // Called after a student is chosen, for example to close the phone search row.
  onSelect?: () => void;
}

// Shows the part of the name that matched in bold, so the person can see
// why each result is there: "Om" -> **Om**ar Adel, Karim **Om**ran.
function HighlightedName({ name, query }: { name: string; query: string }) {
  const start = name.toLowerCase().indexOf(query.toLowerCase());

  if (start === -1 || !query) return <>{name}</>;

  const end = start + query.length;

  return (
    <>
      {name.slice(0, start)}
      <mark className="bg-transparent font-bold text-primary">{name.slice(start, end)}</mark>
      {name.slice(end)}
    </>
  );
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

// The student search in the navbar. It is on every dashboard page, so a
// teacher who knows a name can jump straight to that student from anywhere.
//
// Built as an ARIA combobox: the input stays focused while Arrow keys move a
// highlight through the results (aria-activedescendant), Enter opens the
// highlighted student, and Escape closes the list.
function StudentSearch({ className = '', autoFocus = false, onSelect }: StudentSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { status, results, query: searchedQuery } = useStudentSearch(query);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // useId gives unique ids even when two search boxes are on the page (the
  // desktop one and the phone one).
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const isOpen = isFocused && status !== 'idle';
  const hasResults = results.length > 0;

  const openStudent = (student: StudentSearchResult) => {
    setQuery('');
    setActiveIndex(-1);
    inputRef.current?.blur();
    onSelect?.();

    navigate(`/teacher/students/${student.id}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && hasResults) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && hasResults) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const student = results[activeIndex] ?? (results.length === 1 ? results[0] : undefined);
      if (student) openStudent(student);
    } else if (event.key === 'Escape') {
      setQuery('');
      setActiveIndex(-1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label
        className="
          flex h-11 w-full items-center gap-2
          rounded-[10px] border border-primary/15 bg-surface
          px-3.5 text-ink-muted
          transition-colors
          focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15
        "
      >
        <SearchIcon className="h-[18px] w-[18px] shrink-0" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder="Search students"
          aria-label="Search all students"
          aria-describedby={`${listId}-hint`}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          className="
            min-w-0 flex-1 bg-transparent
            text-sm text-ink
            outline-none
            placeholder:text-ink-muted
          "
        />
      </label>

      {isOpen && (
        <div
          // Keeps the input focused when a result is clicked; otherwise the
          // blur would close the list before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className="
            absolute right-0 top-[52px] z-30
            w-[min(360px,calc(100vw-2rem))]
            rounded-xl border border-border bg-surface p-1.5
            shadow-xl shadow-ink/10
          "
        >
          <p
            aria-live="polite"
            className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-ink-muted"
          >
            {status === 'loading' && !hasResults && 'Searching…'}
            {status === 'error' && 'Search isn’t available right now. Please try again.'}
            {status === 'ready' && !hasResults && `No students match “${searchedQuery}”`}
            {hasResults &&
              status !== 'error' &&
              `${results.length} ${results.length === 1 ? 'student matches' : 'students match'} “${searchedQuery}”`}
          </p>

          <ul
            id={listId}
            role="listbox"
            aria-label="Matching students"
            className={status === 'loading' ? 'opacity-60' : undefined}
          >
            {results.map((student, index) => {
              const isActive = index === activeIndex;

              return (
                <li
                  key={student.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => openStudent(student)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`
                    flex cursor-pointer items-center gap-3
                    rounded-lg p-2.5
                    ${isActive ? 'bg-primary-tint' : ''}
                  `}
                >
                  <span
                    aria-hidden="true"
                    className={`
                      flex h-[34px] w-[34px] shrink-0 items-center justify-center
                      rounded-full text-xs font-bold text-primary
                      ${isActive ? 'bg-surface' : 'bg-primary-tint'}
                    `}
                  >
                    {getInitials(student.name)}
                  </span>

                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">
                      <HighlightedName
                        name={student.name}
                        query={searchedQuery}
                      />
                    </span>
                    <span className="truncate text-xs text-ink-secondary">
                      {student.gradeName} · {student.groupName}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {hasResults && (
            <p className="mt-1 hidden border-t border-border px-2.5 pb-1 pt-2 text-xs text-ink-muted md:block">
              Use ↑ ↓ to move, Enter to open
            </p>
          )}
        </div>
      )}

      {/* Read out with the input, so screen-reader users know when results start. */}
      <span
        id={`${listId}-hint`}
        className="sr-only"
      >
        Type at least {MIN_SEARCH_LENGTH} letters to search.
      </span>
    </div>
  );
}

export default StudentSearch;
