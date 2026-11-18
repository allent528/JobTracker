import { Badge } from "@/components/ui/badge";
import type { StatusEvent } from "@/lib/application-queries";
import { INTERVIEW_KIND_LABELS, INTERVIEW_OUTCOME_LABELS, PENDING_OUTCOME } from "@/lib/closed-sets";
import { formatDateTime, formatDateTimeWithZone } from "@/lib/dates";
import { type Contact, formatDuration, type Interview, interviewerNames, type Note, wasEdited } from "@/lib/detail";
import { isHttpUrl } from "@/lib/schemas/fields";
import { type Status, STATUS_META } from "@/lib/status";

import { AddContact, ContactItem } from "./contacts";
import { AddInterview, InterviewItem } from "./interviews";
import { AddNoteForm, NoteItem } from "./notes";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h2 id={`${id}-heading`} className="text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}

function Fields({ items }: { items: [label: string, value: React.ReactNode][] }) {
  const shown = items.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      {shown.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:col-span-2 sm:grid-cols-subgrid">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="break-words whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const LINK = "break-all underline underline-offset-4";

function ExternalLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {href}
    </a>
  );
}

export function NotesSection({ applicationId, notes, timeZone }: { applicationId: string; notes: Note[]; timeZone: string }) {
  return (
    <Section id="notes" title="Notes">
      <AddNoteForm applicationId={applicationId} />
      {notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ol className="divide-y rounded-lg border bg-card" aria-label="Notes, newest first">
          {notes.map((note) => {
            const added = formatDateTime(note.created_at, timeZone);
            return (
              <li key={`${note.id}:${note.updated_at}`} className="p-4">
                <NoteItem row={note} label={`note added ${added}`}>
                  <p className="break-words whitespace-pre-wrap">{note.body}</p>
                  <p className="text-sm text-muted-foreground">
                    Added <time dateTime={note.created_at}>{added}</time>
                    {wasEdited(note) && (
                      <>
                        {" · Edited "}
                        <time dateTime={note.updated_at}>{formatDateTime(note.updated_at, timeZone)}</time>
                      </>
                    )}
                  </p>
                </NoteItem>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

export function ContactsSection({ applicationId, contacts }: { applicationId: string; contacts: Contact[] }) {
  return (
    <Section id="contacts" title="Contacts">
      {contacts.length === 0 ? (
        <Empty>No contacts yet.</Empty>
      ) : (
        <ul className="grid gap-3" aria-label="Contacts">
          {contacts.map((contact) => (
            <li key={`${contact.id}:${contact.updated_at}`} className="rounded-lg border bg-card p-4">
              <ContactItem row={contact} label={`contact ${contact.name}`}>
                <div>
                  <h3 className="font-semibold break-words">{contact.name}</h3>
                  {contact.title && <p className="break-words text-muted-foreground">{contact.title}</p>}
                </div>
                <Fields
                  items={[
                    ["Email", contact.email && <a href={`mailto:${contact.email}`} className={LINK}>{contact.email}</a>],
                    ["Phone", contact.phone && <a href={`tel:${contact.phone}`} className={LINK}>{contact.phone}</a>],
                    ["LinkedIn", contact.linkedin_url && <ExternalLink href={contact.linkedin_url} />],
                    ["Notes", contact.notes],
                  ]}
                />
              </ContactItem>
            </li>
          ))}
        </ul>
      )}
      <AddContact applicationId={applicationId} />
    </Section>
  );
}

export function InterviewsSection({
  applicationId,
  status,
  interviews,
  contacts,
  timeZone,
}: {
  applicationId: string;
  status: Status;
  interviews: Interview[];
  contacts: Contact[];
  timeZone: string;
}) {
  const picker = contacts.map(({ id, name, title }) => ({ id, name, title }));
  return (
    <Section id="interviews" title="Interviews">
      {interviews.length === 0 ? (
        <Empty>No interviews yet.</Empty>
      ) : (
        <ol className="grid gap-3" aria-label="Interviews, in schedule order">
          {interviews.map((interview) => {
            const when = formatDateTimeWithZone(interview.scheduled_at, timeZone);
            const kind = INTERVIEW_KIND_LABELS[interview.kind];
            const names = interviewerNames(interview, contacts);
            return (
              <li key={`${interview.id}:${interview.updated_at}`} className="rounded-lg border bg-card p-4">
                <InterviewItem row={interview} label={`${kind} interview on ${when}`} contacts={picker} timeZone={timeZone}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{kind}</h3>
                    <Badge variant={interview.outcome === PENDING_OUTCOME ? "secondary" : "outline"}>
                      {INTERVIEW_OUTCOME_LABELS[interview.outcome]}
                    </Badge>
                  </div>
                  <Fields
                    items={[
                      ["When", <time key="when" dateTime={interview.scheduled_at}>{when}</time>],
                      ["Duration", interview.duration_minutes && formatDuration(interview.duration_minutes)],
                      [
                        "Location",
                        interview.location &&
                          (isHttpUrl(interview.location) ? <ExternalLink href={interview.location} /> : interview.location),
                      ],
                      ["Interviewers", names.length > 0 && names.join(", ")],
                      ["Notes", interview.notes],
                    ]}
                  />
                </InterviewItem>
              </li>
            );
          })}
        </ol>
      )}
      <AddInterview applicationId={applicationId} status={status} contacts={picker} timeZone={timeZone} />
    </Section>
  );
}

export function HistorySection({ history, timeZone }: { history: StatusEvent[]; timeZone: string }) {
  return (
    <Section id="history" title="Status history">
      <ol className="divide-y rounded-lg border bg-card" aria-label="Status changes, newest first">
        {history.map((event) => (
          <li key={event.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
            <span>
              {event.from_status === null
                ? `Created as ${STATUS_META[event.to_status].label}`
                : `${STATUS_META[event.from_status].label} → ${STATUS_META[event.to_status].label}`}
            </span>
            <time dateTime={event.changed_at} className="text-muted-foreground tabular-nums">
              {formatDateTime(event.changed_at, timeZone)}
            </time>
          </li>
        ))}
      </ol>
    </Section>
  );
}
