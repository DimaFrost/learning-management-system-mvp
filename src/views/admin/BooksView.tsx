import { useMemo, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, ImagePlus, Library, Loader2, Plus, Search, X } from 'lucide-react';
import type {
  BookLookupResult,
  BookReadingAssignment,
  BookReadingSubmission,
  Course,
  CourseStudent,
  User,
} from '../../types/lms';
import type { BookDraft, ReadingAssignmentDraft } from '../../hooks/useBooks';
import { formatPlatformDate } from '../../utils/dateUtils';
import { ActiveYearGroupBadge, UserAvatar } from './users/usersShared';

type BooksViewProps = {
  assignments: BookReadingAssignment[];
  submissions: BookReadingSubmission[];
  courses: Course[];
  courseStudents: CourseStudent[];
  users: User[];
  loading: boolean;
  error: string | null;
  lookupBooks: (query: string, mode: 'isbn' | 'search') => Promise<BookLookupResult[]>;
  uploadBookCover: (file: File) => Promise<string>;
  createReadingAssignment: (draft: ReadingAssignmentDraft) => Promise<void>;
  updateReadingAssignment: (assignmentId: number, updates: Partial<{
    title: string;
    instructions: string | null;
    dueDate: string | null;
    status: BookReadingAssignment['status'];
  }>) => Promise<void>;
  deleteReadingAssignment: (assignmentId: number) => Promise<void>;
};

const emptyBook: BookDraft = {
  title: '',
  subtitle: null,
  authors: [],
  description: null,
  publisher: null,
  publishedDate: null,
  pageCount: null,
  isbn10: null,
  isbn13: null,
  coverUrl: null,
  sourceProvider: 'manual',
  sourceId: null,
  internalCode: null,
};

function getCourseCount(courseId: number, courseStudents: CourseStudent[]) {
  return courseStudents.filter(enrollment => enrollment.courseId === courseId && enrollment.status === 'active').length;
}

function getCompletionStats(assignmentId: number, courseId: number, submissions: BookReadingSubmission[], courseStudents: CourseStudent[]) {
  const total = getCourseCount(courseId, courseStudents);
  const mine = submissions.filter(submission => submission.assignmentId === assignmentId);
  const complete = mine.filter(submission => submission.status === 'submitted' || submission.status === 'completed').length;
  return { total, complete };
}

export function BooksView({
  assignments,
  submissions,
  courses,
  courseStudents,
  users,
  loading,
  error,
  lookupBooks,
  uploadBookCover,
  createReadingAssignment,
  updateReadingAssignment,
  deleteReadingAssignment,
}: BooksViewProps) {
  const activeCourses = courses.filter(course => course.status === 'active');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupMode, setLookupMode] = useState<'isbn' | 'search'>('search');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [lookupResults, setLookupResults] = useState<BookLookupResult[]>([]);
  const [bookDraft, setBookDraft] = useState<BookDraft>(emptyBook);
  const [courseId, setCourseId] = useState<number>(activeCourses[0]?.id ?? 0);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<BookReadingAssignment['status']>('assigned');
  const [filter, setFilter] = useState<'all' | 'assigned' | 'draft' | 'past_due' | 'completed'>('all');

  const filteredAssignments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return assignments.filter(assignment => {
      if (filter === 'all') return assignment.status !== 'archived';
      if (filter === 'past_due') return assignment.status === 'assigned' && !!assignment.dueDate && assignment.dueDate < today;
      return assignment.status === filter;
    });
  }, [assignments, filter]);

  const filterCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      all: assignments.filter(assignment => assignment.status !== 'archived').length,
      assigned: assignments.filter(assignment => assignment.status === 'assigned').length,
      draft: assignments.filter(assignment => assignment.status === 'draft').length,
      past_due: assignments.filter(assignment => assignment.status === 'assigned' && !!assignment.dueDate && assignment.dueDate < today).length,
    };
  }, [assignments]);

  const selectLookupResult = (result: BookLookupResult) => {
    setBookDraft({
      ...emptyBook,
      ...result,
      sourceProvider: result.sourceProvider,
      sourceId: result.sourceId,
    });
    setAssignmentTitle(result.title);
  };

  const runLookup = async () => {
    setLookupLoading(true);
    try {
      const results = await lookupBooks(lookupQuery, lookupMode);
      setLookupResults(results);
      if (results[0]) selectLookupResult(results[0]);
    } finally {
      setLookupLoading(false);
    }
  };

  const resetForm = () => {
    setBookDraft(emptyBook);
    setAssignmentTitle('');
    setInstructions('');
    setDueDate('');
    setStatus('assigned');
    setLookupQuery('');
    setLookupResults([]);
    setCoverUploading(false);
    setCourseId(activeCourses[0]?.id ?? 0);
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const publicUrl = await uploadBookCover(file);
      setBookDraft(prev => ({
        ...prev,
        coverUrl: publicUrl,
        sourceProvider: prev.sourceProvider === 'manual' || !prev.sourceProvider ? 'manual_upload' : prev.sourceProvider,
      }));
    } finally {
      setCoverUploading(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await createReadingAssignment({
        book: bookDraft,
        courseId,
        title: assignmentTitle || bookDraft.title,
        instructions,
        dueDate,
        status,
      });
      setModalOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="tbo-display text-3xl text-[#171717]">Books</h2>
          <p className="text-sm text-[#737373]">Reading assignments by year group.</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" />
          Add book
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(['all', 'assigned', 'draft', 'past_due'] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-2xl border p-4 text-left ${filter === item ? 'border-[#171717] bg-white' : 'border-[#e5e5e5] bg-[#fafafa]'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#737373]">{item.replace('_', ' ')}</p>
            <p className="mt-2 text-2xl font-semibold text-[#171717]">{filterCounts[item]}</p>
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]">{error}</div>}
      {loading ? (
        <div className="rounded-2xl border border-[#e5e5e5] bg-white p-8 text-center text-[#737373]">Loading books...</div>
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d4d4d4] bg-white p-8 text-center">
          <Library className="mx-auto h-10 w-10 text-[#a3a3a3]" />
          <p className="mt-3 font-semibold text-[#171717]">No reading assignments yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredAssignments.map(assignment => {
            const course = courses.find(item => item.id === assignment.courseId);
            const stats = getCompletionStats(assignment.id, assignment.courseId, submissions, courseStudents);
            const percent = stats.total ? Math.round((stats.complete / stats.total) * 100) : 0;
            const assignedBy = users.find(user => user.id === assignment.assignedBy);
            return (
              <article key={assignment.id} className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
                <div className="flex gap-4 p-4">
                  <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5]">
                    {assignment.book.coverUrl ? <img src={assignment.book.coverUrl} alt="" className="h-full w-full object-cover" /> : <BookOpen className="m-auto mt-12 h-8 w-8 text-[#a3a3a3]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {course && <ActiveYearGroupBadge course={course} />}
                      <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-semibold capitalize text-[#525252]">{assignment.status.replace('_', ' ')}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[#171717]">{assignment.book.title}</h3>
                    <p className="mt-1 truncate text-sm text-[#737373]">{assignment.book.authors.join(', ') || 'Unknown author'}</p>
                    <p className="mt-2 text-sm text-[#525252]">{assignment.title}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#737373]">
                      <Calendar className="h-3.5 w-3.5" />
                      {assignment.dueDate ? `Due ${formatPlatformDate(assignment.dueDate)}` : 'No due date'}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#525252]">{stats.complete}/{stats.total} submitted</p>
                      {assignedBy && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#737373]">
                          <UserAvatar user={assignedBy} size="sm" />
                          {assignedBy.name}
                        </div>
                      )}
                    </div>
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-[#e5e5e5]">
                      <div className="h-full bg-[#15803d]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => updateReadingAssignment(assignment.id, { status: assignment.status === 'draft' ? 'assigned' : 'completed' })} className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#525252]">
                      {assignment.status === 'draft' ? 'Publish' : 'Mark complete'}
                    </button>
                    <button type="button" onClick={() => deleteReadingAssignment(assignment.id)} className="rounded-lg border border-[#fee2e2] bg-white px-3 py-1.5 text-xs font-semibold text-[#b91c1c]">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171717]/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setModalOpen(false)} aria-label="Close" />
          <section className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[#171717]">Add reading assignment</h3>
                <p className="text-sm text-[#737373]">Lookup a book or enter it manually.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e5e5]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="flex gap-2">
                    <select value={lookupMode} onChange={event => setLookupMode(event.target.value as 'isbn' | 'search')} className="h-10 rounded-lg border border-[#d4d4d4] bg-white px-2 text-sm">
                      <option value="search">Title</option>
                      <option value="isbn">ISBN</option>
                    </select>
                    <input value={lookupQuery} onChange={event => setLookupQuery(event.target.value)} placeholder="Search title, author, or ISBN" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                    <button type="button" onClick={runLookup} className="grid h-10 w-10 place-items-center rounded-lg bg-[#171717] text-white">
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {lookupLoading ? <p className="text-sm text-[#737373]">Searching...</p> : lookupResults.map(result => (
                      <button key={`${result.sourceProvider}-${result.sourceId}-${result.title}`} type="button" onClick={() => selectLookupResult(result)} className="flex w-full gap-3 rounded-xl border border-[#e5e5e5] bg-white p-2 text-left hover:bg-[#f5f5f5]">
                        <div className="h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-[#f5f5f5]">
                          {result.coverUrl && <img src={result.coverUrl} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#171717]">{result.title}</p>
                          <p className="truncate text-xs text-[#737373]">{result.authors.join(', ') || result.sourceProvider}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={bookDraft.title} onChange={event => setBookDraft(prev => ({ ...prev, title: event.target.value }))} placeholder="Book title" className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm sm:col-span-2" />
                  <input value={bookDraft.authors?.join(', ') ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, authors: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Authors" className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm sm:col-span-2" />
                  <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-3 sm:grid-cols-[84px_1fr]">
                    <div className="grid h-28 w-20 place-items-center overflow-hidden rounded-xl border border-[#e5e5e5] bg-white text-[#a3a3a3]">
                      {bookDraft.coverUrl ? (
                        <img src={bookDraft.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 text-xs font-semibold text-[#525252] hover:bg-[#f5f5f5]">
                          {coverUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                          {coverUploading ? 'Uploading...' : 'Upload cover'}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={coverUploading}
                            onChange={event => {
                              void handleCoverUpload(event.target.files?.[0] ?? null);
                              event.currentTarget.value = '';
                            }}
                            className="sr-only"
                          />
                        </label>
                        {bookDraft.coverUrl && (
                          <button
                            type="button"
                            onClick={() => setBookDraft(prev => ({ ...prev, coverUrl: null }))}
                            className="h-9 rounded-lg border border-[#fee2e2] bg-white px-3 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        value={bookDraft.coverUrl ?? ''}
                        onChange={event => setBookDraft(prev => ({ ...prev, coverUrl: event.target.value }))}
                        placeholder="Or paste cover image URL"
                        className="h-10 w-full rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm"
                      />
                      <p className="text-xs text-[#737373]">Use upload when the lookup image or external URL is missing or unreliable.</p>
                    </div>
                  </div>
                  <input value={bookDraft.isbn13 ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, isbn13: event.target.value }))} placeholder="ISBN 13" className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  <input value={bookDraft.internalCode ?? ''} onChange={event => setBookDraft(prev => ({ ...prev, internalCode: event.target.value }))} placeholder="Internal code" className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                </div>
                <select value={courseId} onChange={event => setCourseId(Number(event.target.value))} className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm">
                  {activeCourses.map(course => <option key={course.id} value={course.id}>{course.courseType === 'first_year' ? 'First Year' : 'Second Year'} {course.graduationYear}</option>)}
                </select>
                <input value={assignmentTitle} onChange={event => setAssignmentTitle(event.target.value)} placeholder="Assignment title" className="h-10 w-full rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                <textarea value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Instructions" className="min-h-24 w-full rounded-lg border border-[#d4d4d4] p-3 text-sm" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm" />
                  <select value={status} onChange={event => setStatus(event.target.value as BookReadingAssignment['status'])} className="h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm">
                    <option value="assigned">Assigned</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <button type="button" disabled={saving || !bookDraft.title || !courseId} onClick={submit} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 text-sm font-semibold text-white disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Create reading assignment'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
