import { TONE_BAR, TONE_TEXT, formatShortDate, toneOf } from '../profileFormat';
import type { ExamResult } from '../profileTypes';

// A score as a whole percent: 17 / 20 -> 85.
const percentOf = (exam: ExamResult) =>
  exam.score === null ? null : Math.round((exam.score / exam.maxScore) * 100);

// One row per exam: name, a bar, and the mark as % and as "17/20". The
// percent is computed here from score and maxScore; the server sends the raw
// mark, the way the teacher typed it.
function ExamList({ exams }: { exams: ExamResult[] }) {
  return (
    <ul aria-label="Exam results">
      {exams.map((exam) => {
        const percent = percentOf(exam);

        return (
          <li
            key={exam.examId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-border-strong py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_112px]"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold text-ink">{exam.title}</span>
              <span className="text-xs text-ink-muted">
                {formatShortDate(exam.heldAt)} · {exam.kind === 'quiz' ? 'Quiz' : 'Exam'}
              </span>
            </span>

            {/* The bar: its own row on phones, the middle column from sm. */}
            <span
              aria-hidden="true"
              className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-border sm:order-none sm:col-span-1"
            >
              {percent !== null && (
                <span
                  className={`block h-full rounded-full ${TONE_BAR[toneOf(percent)]}`}
                  style={{ width: `${percent}%` }}
                />
              )}
            </span>

            <span className="text-right text-sm tabular-nums">
              {percent === null ? (
                <span className="font-semibold text-ink-muted">
                  {exam.status === 'absent' ? 'Absent' : 'No mark yet'}
                </span>
              ) : (
                <>
                  <strong className={TONE_TEXT[toneOf(percent)]}>{percent}%</strong>{' '}
                  <span className="text-ink-muted">
                    {exam.score}/{exam.maxScore}
                  </span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default ExamList;
