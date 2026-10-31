import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { PAYMENT_STATUS } from '../profileFormat';

import type { StudentReport } from './reportData';

// The PDF report's layout. Everything it shows is worked out in reportData.ts;
// this file only places it. Built-in Helvetica: no font file to download.

const color = {
  ink: '#171a2b',
  secondary: '#555b70',
  muted: '#6a7085',
  border: '#e4e6ef',
  page: '#f6f7fb',
  primary: '#3431e4',
  primaryTint: '#eeeffe',
  danger: '#a8261d',
};

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontFamily: 'Helvetica', fontSize: 10, color: color.ink },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: `2 solid ${color.primary}`,
    paddingBottom: 12,
  },
  brand: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: color.primary, letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  period: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 9, color: color.muted, marginTop: 2 },
  student: { marginTop: 18 },
  name: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, backgroundColor: color.page, borderRadius: 6, padding: 10 },
  tileLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: color.muted, letterSpacing: 0.6 },
  tileValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  row: { flexDirection: 'row', borderBottom: `1 solid ${color.border}`, paddingVertical: 5 },
  headRow: {
    flexDirection: 'row',
    backgroundColor: color.primaryTint,
    paddingVertical: 5,
    borderRadius: 3,
  },
  head: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: color.secondary },
  cell: { paddingHorizontal: 6 },
  note: { fontSize: 8.5, color: color.danger, paddingHorizontal: 6, paddingBottom: 5 },
  empty: { color: color.muted, paddingVertical: 6 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: color.muted,
  },
});

const money = (amount: number) => `${amount.toLocaleString('en-GB')} EGP`;
const percent = (value: number | null) => (value === null ? '—' : `${value}%`);

// A table row: each cell's width as a flex share.
function Row({
  cells,
  widths,
  isHead = false,
}: {
  cells: string[];
  widths: number[];
  isHead?: boolean;
}) {
  return (
    <View
      style={isHead ? styles.headRow : styles.row}
      wrap={false}
    >
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[styles.cell, { flex: widths[i] }, isHead ? styles.head : {}]}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.small}>{detail}</Text>
    </View>
  );
}

function StudentReportPdf({ report }: { report: StudentReport }) {
  const { student, attendance, exams, fees } = report;
  const marked = exams.rows.filter((exam) => exam.percent !== null).length;

  return (
    <Document
      title={`${student.name} · ${report.period.label}`}
      author={report.teacherName}
      creator="Diraya"
    >
      <Page
        size="A4"
        style={styles.page}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>DIRAYA</Text>
            <Text style={styles.title}>Student report</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.period}>{report.period.label}</Text>
            <Text style={styles.small}>
              Prepared by {report.teacherName} on {report.preparedOn}
            </Text>
          </View>
        </View>

        <View style={styles.student}>
          <Text style={styles.name}>{student.name}</Text>
          <Text style={styles.small}>
            {student.code} · {student.gradeName} · {student.groupName}
          </Text>
        </View>

        <View style={styles.tiles}>
          <Tile
            label="Attendance"
            value={percent(attendance.rate)}
            detail={
              attendance.total === 0
                ? 'No sessions'
                : `${attendance.attended} of ${attendance.total} sessions`
            }
          />
          <Tile
            label="Average mark"
            value={percent(exams.average)}
            detail={
              marked === 0 ? 'No marks' : `${marked} ${marked === 1 ? 'exam' : 'exams'} with a mark`
            }
          />
          <Tile
            label="Fees"
            value={fees.owed === 0 ? 'All paid' : money(fees.owed)}
            detail={fees.owed === 0 ? 'Nothing owed' : 'still owed'}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <Row
            isHead
            widths={[3, 2, 2, 2, 2, 2]}
            cells={['Month', 'Present', 'Late', 'Absent', 'Excused', 'Rate']}
          />
          {attendance.rows.map((row) => (
            <View
              key={row.month}
              wrap={false}
            >
              <Row
                widths={[3, 2, 2, 2, 2, 2]}
                cells={[
                  row.label,
                  `${row.present}`,
                  `${row.late}`,
                  `${row.absent}`,
                  `${row.excused}`,
                  percent(row.rate),
                ]}
              />
              {row.absences.length > 0 && (
                <Text style={styles.note}>Absent: {row.absences.join(', ')}</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exams &amp; marks</Text>
          {exams.rows.length === 0 ? (
            <Text style={styles.empty}>No exams in this period.</Text>
          ) : (
            <>
              <Row
                isHead
                widths={[2.2, 4, 2, 1.6]}
                cells={['Date', 'Exam', 'Mark', '%']}
              />
              {exams.rows.map((exam) => (
                <Row
                  key={exam.examId}
                  widths={[2.2, 4, 2, 1.6]}
                  cells={[
                    exam.day,
                    exam.title,
                    exam.status === 'scored'
                      ? `${exam.score} / ${exam.maxScore}`
                      : exam.status === 'absent'
                        ? 'Absent'
                        : 'No mark yet',
                    percent(exam.percent),
                  ]}
                />
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fees</Text>
          {fees.rows.length === 0 ? (
            <Text style={styles.empty}>No fees in this period.</Text>
          ) : (
            <>
              <Row
                isHead
                widths={[3, 2, 2, 3]}
                cells={['Month', 'Due', 'Paid', 'Status']}
              />
              {fees.rows.map((fee) => (
                <Row
                  key={fee.month}
                  widths={[3, 2, 2, 3]}
                  cells={[
                    new Date(`${fee.month}-01T00:00:00Z`).toLocaleString('en-GB', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }),
                    money(fee.amountDue),
                    money(fee.amountPaid),
                    fee.status === 'skipped' && fee.skipReason
                      ? `Skipped (${fee.skipReason})`
                      : PAYMENT_STATUS[fee.status].label,
                  ]}
                />
              ))}
            </>
          )}
        </View>

        <View
          style={styles.footer}
          fixed
        >
          <Text>
            {student.name} · {report.period.label}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export default StudentReportPdf;
