import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  StyleSheet,
} from '@react-pdf/renderer';

const DARK_BG = '#1a2332';
const ACCENT = '#0f766e';
const ACCENT_SOFT = '#5eead4';
const TEXT_HEADING = '#0f172a';
const TEXT_BODY = '#334155';
const TEXT_MUTED = '#64748b';
const TEXT_SIDEBAR = '#cbd5e1';
const BORDER = '#e2e8f0';
const TAG_BG = '#f1f5f9';

const SIDEBAR_W = 168;
const GUTTER = 20;

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    paddingTop: 26,
    paddingBottom: 26,
  },
  /* ─── Fixed sidebar: lives in the page margin, repeats every page ─── */
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_W,
    backgroundColor: DARK_BG,
    paddingTop: 26,
    paddingHorizontal: 14,
  },
  photo: {
    width: 78,
    height: 78,
    borderRadius: 39,
    marginBottom: 12,
    alignSelf: 'center',
  },
  sidebarName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 5,
    lineHeight: 1.15,
  },
  sidebarTitleMini: {
    fontSize: 6.3,
    color: ACCENT_SOFT,
    textAlign: 'center',
    lineHeight: 1.3,
    marginBottom: 14,
  },
  sidebarRuler: {
    height: 1,
    backgroundColor: ACCENT_SOFT,
    opacity: 0.22,
    marginBottom: 12,
  },
  sidebarBlock: {
    marginBottom: 12,
  },
  sidebarBlockTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: ACCENT_SOFT,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  contactBlock: {
    marginBottom: 3,
  },
  contactLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 1,
  },
  contactValue: {
    fontSize: 7.3,
    color: TEXT_SIDEBAR,
    lineHeight: 1.35,
  },
  contactLink: {
    fontSize: 7.3,
    color: TEXT_SIDEBAR,
    lineHeight: 1.35,
    textDecoration: 'none',
  },
  sidebarSkillTitle: {
    fontSize: 7.3,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 2,
    marginTop: 5,
  },
  sidebarSkill: {
    fontSize: 7.3,
    color: TEXT_SIDEBAR,
    lineHeight: 1.4,
    marginLeft: 4,
  },

  /* ─── Main content: padding-left clears the sidebar on EVERY page.
         Vertical margins come from the Page so they repeat on all pages. ─── */
  main: {
    paddingLeft: SIDEBAR_W + GUTTER,
    paddingRight: 32,
  },
  mainName: {
    fontSize: 23,
    fontWeight: 'bold',
    color: TEXT_HEADING,
    marginBottom: 1,
  },
  mainTitle: {
    fontSize: 8,
    color: ACCENT,
    lineHeight: 1.3,
    marginBottom: 10,
  },
  mainRuler: {
    height: 2,
    backgroundColor: ACCENT,
    marginBottom: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_HEADING,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionLine: {
    height: 1,
    backgroundColor: ACCENT,
    opacity: 0.3,
    marginBottom: 8,
    width: '50%',
  },
  summaryText: {
    fontSize: 8.5,
    color: TEXT_BODY,
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  /* ─── Experience ─── */
  expItem: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  expItemNoBorder: {
    marginBottom: 10,
  },
  expHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  expCompany: {
    fontSize: 10,
    fontWeight: 'bold',
    color: TEXT_HEADING,
  },
  expRole: {
    fontSize: 8.5,
    color: ACCENT,
    fontWeight: 'bold',
    marginTop: 1,
    marginBottom: 2,
  },
  expMeta: {
    fontSize: 7.3,
    color: TEXT_MUTED,
    textAlign: 'right',
  },
  expDetail: {
    fontSize: 8,
    color: TEXT_BODY,
    lineHeight: 1.35,
    marginLeft: 8,
    marginBottom: 1,
  },

  /* ─── Education ─── */
  eduItem: {
    marginBottom: 7,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  eduItemLast: {
    marginBottom: 2,
  },
  eduRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eduMain: { flex: 1 },
  eduDegree: {
    fontSize: 9,
    fontWeight: 'bold',
    color: TEXT_HEADING,
  },
  eduInstitution: {
    fontSize: 8,
    color: ACCENT,
    fontWeight: 'bold',
    marginBottom: 1,
    marginTop: 1,
  },
  eduDesc: {
    fontSize: 8,
    color: TEXT_BODY,
    lineHeight: 1.35,
  },
  eduYear: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginLeft: 10,
  },

  /* ─── Skills ─── */
  skillCatBlock: { marginBottom: 7 },
  skillCatTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: TEXT_HEADING,
    marginBottom: 2,
    marginTop: 5,
  },
  skillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillChip: {
    fontSize: 7.5,
    color: TEXT_BODY,
    backgroundColor: TAG_BG,
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    marginRight: 3,
    marginBottom: 3,
    borderRadius: 2,
  },

  /* ─── Soft / Lang / Certs ─── */
  softGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  softChip: {
    fontSize: 8,
    color: TEXT_BODY,
    backgroundColor: TAG_BG,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
    borderRadius: 2,
  },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  langChip: {
    fontSize: 8,
    color: TEXT_BODY,
    backgroundColor: TAG_BG,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 5,
    marginBottom: 4,
    borderRadius: 2,
  },
  certGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  certChip: {
    fontSize: 7.5,
    color: TEXT_BODY,
    backgroundColor: TAG_BG,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 3,
    marginBottom: 3,
    borderRadius: 2,
  },

  /* ─── Presentations ─── */
  presItem: {
    marginBottom: 5,
    paddingLeft: 7,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  presTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: TEXT_HEADING,
    marginBottom: 1,
  },
  presMeta: {
    fontSize: 7.5,
    color: ACCENT,
    marginBottom: 1,
  },
  presLoc: { fontSize: 7.5, color: TEXT_MUTED },

  /* ─── Footer ─── */
  footer: {
    marginTop: 14,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: {
    fontSize: 7,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
});

interface ProfessionalCvPdfProps {
  profile: any;
  lang: 'es' | 'en';
  photoBase64: string;
}

/** Split an array into fixed-size chunks (for unbreakable chip groups). */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ProfessionalCvPdf({
  profile,
  lang,
  photoBase64,
}: ProfessionalCvPdfProps) {
  const isEs = lang === 'es';
  const {
    personal,
    experience,
    education,
    skills,
    certifications_es,
    certifications_en,
    presentations_es,
    presentations_en,
    soft_skills_es,
    soft_skills_en,
    languages_es,
    languages_en,
  } = profile;

  const t = (es: string, en: string) => (isEs ? es : en);
  const currentTitle = isEs ? personal.title_es : personal.title_en;
  const currentSummary = isEs ? personal.summary_es : personal.summary_en;
  const currentSkillsCategories = isEs
    ? skills.categories_es
    : skills.categories_en;
  const currentSoftSkills = isEs ? soft_skills_es : soft_skills_en;
  const currentLanguages = isEs ? languages_es : languages_en;
  const currentCertifications = isEs ? certifications_es : certifications_en;
  const currentPresentations = isEs ? presentations_es : presentations_en;
  const location = isEs
    ? personal.contact.location_es
    : personal.contact.location_en;

  const linkedinUser =
    personal.contact.linkedin?.split('/').pop() || 'edison-isaza';
  const githubUser =
    personal.contact.github?.split('/').pop() || 'editech-dev';

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Fixed sidebar — repeats on every page, sits in the page margin */}
        <View fixed style={styles.sidebar}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={photoBase64} style={styles.photo} />
          <Text style={styles.sidebarName}>{personal.name}</Text>
          <Text style={styles.sidebarTitleMini}>{currentTitle}</Text>

          <View style={styles.sidebarRuler} />

          <View style={styles.sidebarBlock}>
            <Text style={styles.sidebarBlockTitle}>
              {t('Contacto', 'Contact')}
            </Text>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>
                {t('Ubicación', 'Location')}
              </Text>
              <Text style={styles.contactValue}>{location}</Text>
            </View>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>Email</Text>
              <Link
                src={`mailto:${personal.contact.email}`}
                style={styles.contactLink}
              >
                {personal.contact.email}
              </Link>
            </View>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>{t('Teléfono', 'Phone')}</Text>
              <Link
                src={`tel:${personal.contact.phone.replace(/[\s-]/g, '')}`}
                style={styles.contactLink}
              >
                {personal.contact.phone}
              </Link>
            </View>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>LinkedIn</Text>
              <Link src={personal.contact.linkedin} style={styles.contactLink}>
                linkedin.com/in/{linkedinUser}
              </Link>
            </View>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>GitHub</Text>
              <Link src={personal.contact.github} style={styles.contactLink}>
                github.com/{githubUser}
              </Link>
            </View>
            <View style={styles.contactBlock}>
              <Text style={styles.contactLabel}>Web</Text>
              <Link src={personal.contact.website} style={styles.contactLink}>
                editech.dev
              </Link>
            </View>
          </View>

          <View style={styles.sidebarRuler} />

          <View style={styles.sidebarBlock}>
            <Text style={styles.sidebarBlockTitle}>
              {t('Áreas de Expertise', 'Core Expertise')}
            </Text>
            {currentSkillsCategories.slice(0, 3).map((cat: any, idx: number) => (
              <View key={idx}>
                <Text style={styles.sidebarSkillTitle}>{cat.name}</Text>
                {cat.items.slice(0, 3).map((item: string, iIdx: number) => (
                  <Text key={iIdx} style={styles.sidebarSkill}>
                    {'\u2022'} {item}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Main flowing content — paddingLeft keeps it clear of the sidebar
            on every auto-generated page */}
        <View style={styles.main}>
          <Text style={styles.mainName}>{personal.name}</Text>
          <Text style={styles.mainTitle}>{currentTitle}</Text>
          <View style={styles.mainRuler} />

          {/* Professional Summary — short, keep whole */}
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {t('Perfil Profesional', 'Professional Summary')}
            </Text>
            <View style={styles.sectionLine} />
            <Text style={styles.summaryText}>{currentSummary}</Text>
          </View>

          {/* Work Experience — header travels with the first job block */}
          <View style={styles.section}>
            {experience.map((job: any, idx: number) => (
              <View
                key={idx}
                style={
                  idx === experience.length - 1
                    ? styles.expItemNoBorder
                    : styles.expItem
                }
                wrap={false}
              >
                {idx === 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>
                      {t('Experiencia Laboral', 'Work Experience')}
                    </Text>
                    <View style={styles.sectionLine} />
                  </View>
                )}
                <View style={styles.expHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expCompany}>{job.company}</Text>
                    <Text style={styles.expRole}>
                      {isEs ? job.role_es : job.role_en}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.expMeta}>
                      {isEs ? job.dates_es : job.dates_en}
                    </Text>
                    <Text style={styles.expMeta}>
                      {isEs ? job.location_es : job.location_en}
                    </Text>
                  </View>
                </View>
                {(isEs ? job.details_es : job.details_en).map(
                  (detail: string, dIdx: number) => (
                    <Text key={dIdx} style={styles.expDetail}>
                      {'\u2022'} {detail}
                    </Text>
                  )
                )}
              </View>
            ))}
          </View>

          {/* Technical Skills — header travels with the first category block */}
          <View style={styles.section}>
            {currentSkillsCategories.map((cat: any, idx: number) => (
              <View key={idx} style={styles.skillCatBlock} wrap={false}>
                {idx === 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>
                      {t('Habilidades Técnicas', 'Technical Skills')}
                    </Text>
                    <View style={styles.sectionLine} />
                  </View>
                )}
                <Text style={styles.skillCatTitle}>{cat.name}</Text>
                <View style={styles.skillRow}>
                  {cat.items.map((item: string, iIdx: number) => (
                    <Text key={iIdx} style={styles.skillChip}>
                      {item}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Soft Skills — whole section stays together */}
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {t('Habilidades Blandas', 'Soft Skills')}
            </Text>
            <View style={styles.sectionLine} />
            <View style={styles.softGrid}>
              {currentSoftSkills.map((skill: string, idx: number) => (
                <Text key={idx} style={styles.softChip}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>

          {/* Education — header travels with the first education block */}
          <View style={styles.section}>
            {education.map((edu: any, idx: number) => (
              <View
                key={idx}
                style={
                  idx === education.length - 1
                    ? styles.eduItemLast
                    : styles.eduItem
                }
                wrap={false}
              >
                {idx === 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>
                      {t('Educación', 'Education')}
                    </Text>
                    <View style={styles.sectionLine} />
                  </View>
                )}
                <View style={styles.eduRow}>
                  <View style={styles.eduMain}>
                    <Text style={styles.eduDegree}>
                      {isEs ? edu.degree_es : edu.degree_en}
                    </Text>
                    <Text style={styles.eduInstitution}>{edu.institution}</Text>
                    {(edu.description_es || edu.description_en) && (
                      <Text style={styles.eduDesc}>
                        {isEs ? edu.description_es : edu.description_en}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.eduYear}>{edu.year}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Languages — whole section stays together */}
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {t('Idiomas', 'Languages')}
            </Text>
            <View style={styles.sectionLine} />
            <View style={styles.langGrid}>
              {currentLanguages.map((langItem: any, idx: number) => (
                <Text key={idx} style={styles.langChip}>
                  <Text style={{ fontWeight: 'bold' }}>
                    {langItem.language}
                  </Text>
                  {' — '}
                  {langItem.level}
                </Text>
              ))}
            </View>
          </View>

          {/* Certifications — chunked into unbreakable groups so the header
              never orphans and chip rows never split mid-page */}
          <View style={styles.section}>
            {chunkArray<string>(currentCertifications, 9).map(
              (group: string[], gIdx: number) => (
                <View key={gIdx} wrap={false}>
                  {gIdx === 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>
                        {t('Certificaciones', 'Certifications')}
                      </Text>
                      <View style={styles.sectionLine} />
                    </View>
                  )}
                  <View style={styles.certGrid}>
                    {group.map((cert: string, idx: number) => (
                      <Text key={idx} style={styles.certChip}>
                        {cert}
                      </Text>
                    ))}
                  </View>
                </View>
              )
            )}
          </View>

          {/* Presentations — whole section stays together */}
          {currentPresentations && currentPresentations.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>
                {t('Ponencias y Charlas', 'Presentations & Talks')}
              </Text>
              <View style={styles.sectionLine} />
              {currentPresentations.map((pres: any, idx: number) => (
                <View key={idx} style={styles.presItem}>
                  <Text style={styles.presTitle}>{pres.title}</Text>
                  <Text style={styles.presMeta}>
                    {pres.institution} ({pres.date})
                  </Text>
                  <Text style={styles.presLoc}>{pres.location}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {'\u00A9'} 2026 {personal.name} — editech.dev —{' '}
              {t(
                'Generado desde editech.dev/cv',
                'Generated from editech.dev/cv'
              )}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
