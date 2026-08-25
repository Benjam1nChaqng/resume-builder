import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { RenderableResume } from "./render";

export function keepPdfWordUnbroken(word: string): string[] {
  return [word];
}

Font.registerHyphenationCallback(keepPdfWordUnbroken);

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#171717",
    fontFamily: "Helvetica",
    fontSize: 9.25,
    lineHeight: 1.35,
    paddingBottom: 32,
    paddingHorizontal: 42,
    paddingTop: 32,
  },
  header: {
    marginBottom: 14,
    textAlign: "center",
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    lineHeight: 1.1,
    marginBottom: 5,
  },
  contact: {
    color: "#404040",
    fontSize: 8.5,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    borderBottomColor: "#737373",
    borderBottomWidth: 0.75,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginBottom: 5,
    paddingBottom: 2,
    textTransform: "uppercase",
  },
  entry: {
    marginBottom: 7,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rowMain: {
    flexGrow: 1,
    paddingRight: 12,
  },
  rowMeta: {
    color: "#404040",
    fontSize: 8.5,
    maxWidth: 155,
    textAlign: "right",
  },
  strong: {
    fontFamily: "Helvetica-Bold",
  },
  secondary: {
    color: "#404040",
  },
  bullet: {
    marginLeft: 9,
    marginTop: 2,
    paddingLeft: 4,
    textIndent: -7,
  },
  projectDescription: {
    marginTop: 2,
  },
  skillRow: {
    marginBottom: 2,
  },
});

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${match[1]}` : match[1];
}

function dateRange(
  startDate: string | null,
  endDate: string | null,
  current = false,
): string {
  return [formatDate(startDate), current ? "Present" : formatDate(endDate)]
    .filter(Boolean)
    .join(" - ");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ResumePdfDocument({ data }: { data: RenderableResume }) {
  const groupedSkills = new Map<string, string[]>();
  for (const item of data.skills) {
    const category = item.category?.trim() || "Skills";
    groupedSkills.set(category, [...(groupedSkills.get(category) ?? []), item.name]);
  }

  return (
    <Document
      author={data.contactInfo?.fullName ?? undefined}
      subject="Resume"
      title={data.title}
    >
      <Page size="LETTER" style={styles.page} wrap>
        {data.contactInfo && (
          <View style={styles.header}>
            <Text style={styles.name}>{data.contactInfo.fullName}</Text>
            <Text style={styles.contact}>
              {[
                data.contactInfo.email,
                data.contactInfo.phone,
                data.contactInfo.location,
                ...data.contactInfo.links.map((link) => link.url),
              ]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          </View>
        )}

        {data.experiences.length > 0 && (
          <Section title="Experience">
            {data.experiences.map((item) => (
              <View
                key={item.id}
                style={styles.entry}
                wrap={item.bullets.length > 7}
              >
                <View style={styles.row} wrap={false}>
                  <View style={styles.rowMain}>
                    <Text style={styles.strong}>{item.role}</Text>
                    <Text style={styles.secondary}>
                      {[item.company, item.location].filter(Boolean).join(" | ")}
                    </Text>
                  </View>
                  <Text style={styles.rowMeta}>
                    {dateRange(item.startDate, item.endDate, item.current)}
                  </Text>
                </View>
                {item.bullets.map((itemBullet) => (
                  <Text key={itemBullet.id} style={styles.bullet}>
                    - {itemBullet.text}
                  </Text>
                ))}
              </View>
            ))}
          </Section>
        )}

        {data.projects.length > 0 && (
          <Section title="Projects">
            {data.projects.map((item) => (
              <View key={item.id} style={styles.entry}>
                <View style={styles.row} wrap={false}>
                  <Text style={styles.strong}>{item.name}</Text>
                  {item.link ? <Text style={styles.rowMeta}>{item.link}</Text> : null}
                </View>
                {item.description ? (
                  <Text style={styles.projectDescription}>{item.description}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {data.educations.length > 0 && (
          <Section title="Education">
            {data.educations.map((item) => (
              <View key={item.id} style={[styles.entry, styles.row]} wrap={false}>
                <View style={styles.rowMain}>
                  <Text style={styles.strong}>{item.school}</Text>
                  <Text style={styles.secondary}>
                    {[item.degree, item.field].filter(Boolean).join(", ")}
                    {item.gpa ? ` | GPA: ${item.gpa}` : ""}
                  </Text>
                </View>
                <Text style={styles.rowMeta}>
                  {dateRange(item.startDate, item.endDate)}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {groupedSkills.size > 0 && (
          <Section title="Skills">
            {[...groupedSkills.entries()].map(([category, names]) => (
              <Text key={category} style={styles.skillRow}>
                <Text style={styles.strong}>{category}: </Text>
                {names.join(", ")}
              </Text>
            ))}
          </Section>
        )}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(data: RenderableResume): Promise<Buffer> {
  return renderToBuffer(<ResumePdfDocument data={data} />);
}
