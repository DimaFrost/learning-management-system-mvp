import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFileToStorage } from '../utils/storageOperations';
import type {
  Book,
  BookLookupResult,
  BookReadingAssignment,
  BookReadingAssignmentStatus,
  BookReadingSubmission,
  BookReadingSubmissionStatus,
  Course,
  CourseStudent,
  User,
} from '../types/lms';
import { isCourseActive } from '../utils/courseUtils';

type BookRow = {
  id: number;
  internal_code: string | null;
  title: string;
  subtitle: string | null;
  authors: string[] | null;
  description: string | null;
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  isbn_10: string | null;
  isbn_13: string | null;
  cover_url: string | null;
  source_provider: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: number;
  book_id: number;
  course_id: number;
  assigned_by: string | null;
  title: string;
  instructions: string | null;
  due_date: string | null;
  status: BookReadingAssignmentStatus;
  created_at: string;
  updated_at: string;
  book: BookRow | BookRow[] | null;
};

type SubmissionRow = {
  id: number;
  assignment_id: number;
  student_id: string;
  status: BookReadingSubmissionStatus;
  response_text: string | null;
  response_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

export type BookDraft = Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>> & {
  title: string;
};

export type ReadingAssignmentDraft = {
  book: BookDraft;
  courseId: number;
  title: string;
  instructions?: string | null;
  dueDate?: string | null;
  status: BookReadingAssignmentStatus;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    internalCode: row.internal_code,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors ?? [],
    description: row.description,
    publisher: row.publisher,
    publishedDate: row.published_date,
    pageCount: row.page_count,
    isbn10: row.isbn_10,
    isbn13: row.isbn_13,
    coverUrl: row.cover_url,
    sourceProvider: row.source_provider,
    sourceId: row.source_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: AssignmentRow): BookReadingAssignment | null {
  const book = asSingle(row.book);
  if (!book) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    courseId: row.course_id,
    assignedBy: row.assigned_by,
    title: row.title,
    instructions: row.instructions,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    book: mapBook(book),
  };
}

function mapSubmission(row: SubmissionRow): BookReadingSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    status: row.status,
    responseText: row.response_text,
    responseUrl: row.response_url,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewerNote: row.reviewer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bookToRow(book: BookDraft, currentUserId: string | null) {
  return {
    internal_code: book.internalCode ?? null,
    title: book.title,
    subtitle: book.subtitle ?? null,
    authors: book.authors ?? [],
    description: book.description ?? null,
    publisher: book.publisher ?? null,
    published_date: book.publishedDate ?? null,
    page_count: book.pageCount ?? null,
    isbn_10: book.isbn10 ?? null,
    isbn_13: book.isbn13 ?? null,
    cover_url: book.coverUrl ?? null,
    source_provider: book.sourceProvider ?? null,
    source_id: book.sourceId ?? null,
    created_by: currentUserId,
    updated_at: new Date().toISOString(),
  };
}

function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function safePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'book-cover';
}

function pickIndustryIdentifier(
  identifiers: Array<{ type?: string; identifier?: string }> | undefined,
  type: 'ISBN_10' | 'ISBN_13'
) {
  return identifiers?.find(identifier => identifier.type === type)?.identifier ?? null;
}

function mapGoogleBook(item: any): BookLookupResult {
  const info = item.volumeInfo ?? {};
  const cover =
    info.imageLinks?.extraLarge ??
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    null;

  return {
    title: info.title ?? 'Untitled book',
    subtitle: info.subtitle ?? null,
    authors: Array.isArray(info.authors) ? info.authors : [],
    description: info.description ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
    isbn10: pickIndustryIdentifier(info.industryIdentifiers, 'ISBN_10'),
    isbn13: pickIndustryIdentifier(info.industryIdentifiers, 'ISBN_13'),
    coverUrl: cover ? String(cover).replace(/^http:/, 'https:') : null,
    sourceProvider: 'google_books',
    sourceId: item.id ?? null,
  };
}

function mapOpenLibraryBook(item: any, fallbackIsbn?: string): BookLookupResult {
  const isbn13 = Array.isArray(item.isbn_13) ? item.isbn_13[0] ?? null : null;
  const isbn10 = Array.isArray(item.isbn_10) ? item.isbn_10[0] ?? null : null;
  const coverId = item.cover_i ?? item.cover_id ?? null;

  return {
    title: item.title ?? 'Untitled book',
    subtitle: item.subtitle ?? null,
    authors: Array.isArray(item.author_name)
      ? item.author_name
      : Array.isArray(item.authors)
        ? item.authors.map((author: any) => author.name).filter(Boolean)
        : [],
    description: typeof item.description === 'string' ? item.description : item.description?.value ?? null,
    publisher: Array.isArray(item.publisher) ? item.publisher[0] ?? null : item.publishers?.[0]?.name ?? null,
    publishedDate: item.first_publish_year ? String(item.first_publish_year) : item.publish_date ?? null,
    pageCount: typeof item.number_of_pages_median === 'number' ? item.number_of_pages_median : item.number_of_pages ?? null,
    isbn10,
    isbn13: isbn13 ?? (fallbackIsbn?.length === 13 ? fallbackIsbn : null),
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    sourceProvider: 'open_library',
    sourceId: item.key ?? item.olid ?? null,
  };
}

async function lookupBooksClientFallback(query: string, mode: 'isbn' | 'search'): Promise<BookLookupResult[]> {
  const googleUrl = new URL('https://www.googleapis.com/books/v1/volumes');
  googleUrl.searchParams.set('q', mode === 'isbn' ? `isbn:${normalizeIsbn(query)}` : query);
  googleUrl.searchParams.set('printType', 'books');
  googleUrl.searchParams.set('maxResults', mode === 'isbn' ? '5' : '10');

  try {
    const googleResponse = await fetch(googleUrl.toString());
    if (googleResponse.ok) {
      const googleData = await googleResponse.json();
      const googleResults = Array.isArray(googleData.items)
        ? googleData.items.map(mapGoogleBook).filter((book: BookLookupResult) => book.title)
        : [];
      if (googleResults.length > 0) return googleResults;
    }
  } catch (error) {
    console.warn('Google Books fallback failed', error);
  }

  try {
    if (mode === 'isbn') {
      const isbn = normalizeIsbn(query);
      const openLibraryResponse = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
      if (!openLibraryResponse.ok) return [];
      return [mapOpenLibraryBook(await openLibraryResponse.json(), isbn)];
    }

    const openLibraryUrl = new URL('https://openlibrary.org/search.json');
    openLibraryUrl.searchParams.set('q', query);
    openLibraryUrl.searchParams.set('limit', '10');
    const openLibraryResponse = await fetch(openLibraryUrl.toString());
    if (!openLibraryResponse.ok) return [];
    const openLibraryData = await openLibraryResponse.json();
    return Array.isArray(openLibraryData.docs) ? openLibraryData.docs.map(mapOpenLibraryBook) : [];
  } catch (error) {
    console.warn('Open Library fallback failed', error);
    return [];
  }
}

export function getStudentActiveCourseIds(studentId: string, courseStudents: CourseStudent[], courses: Course[]) {
  const activeCourseIds = new Set(courses.filter(isCourseActive).map(course => course.id));
  return courseStudents
    .filter(enrollment =>
      enrollment.studentId === studentId &&
      enrollment.status === 'active' &&
      activeCourseIds.has(enrollment.courseId)
    )
    .map(enrollment => enrollment.courseId);
}

export function useBooks(currentUser: User, courses: Course[], courseStudents: CourseStudent[]) {
  const [assignments, setAssignments] = useState<BookReadingAssignment[]>([]);
  const [submissions, setSubmissions] = useState<BookReadingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('book_reading_assignments')
        .select(`
          id, book_id, course_id, assigned_by, title, instructions, due_date, status, created_at, updated_at,
          book:books (
            id, internal_code, title, subtitle, authors, description, publisher, published_date,
            page_count, isbn_10, isbn_13, cover_url, source_provider, source_id,
            created_by, created_at, updated_at
          )
        `)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (assignmentError) throw assignmentError;

      const { data: submissionRows, error: submissionError } = await supabase
        .from('book_reading_submissions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (submissionError) throw submissionError;

      setAssignments((assignmentRows ?? [])
        .map(row => mapAssignment(row as AssignmentRow))
        .filter((item): item is BookReadingAssignment => !!item));
      setSubmissions((submissionRows ?? []).map(row => mapSubmission(row as SubmissionRow)));
    } catch (err) {
      console.error('Failed to load books', err);
      setError('Failed to load books');
      setAssignments([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetchBooks();
  }, [refetchBooks]);

  const myCourseIds = useMemo(
    () => getStudentActiveCourseIds(currentUser.id, courseStudents, courses),
    [courseStudents, courses, currentUser.id]
  );

  const myAssignments = useMemo(
    () => assignments.filter(assignment =>
      assignment.status !== 'draft' &&
      assignment.status !== 'archived' &&
      myCourseIds.includes(assignment.courseId)
    ),
    [assignments, myCourseIds]
  );

  const lookupBooks = useCallback(async (query: string, mode: 'isbn' | 'search'): Promise<BookLookupResult[]> => {
    const normalized = query.trim();
    if (!normalized) return [];

    const { data, error: lookupError } = await supabase.functions.invoke('book-lookup', {
      body: { query: normalized, mode },
    });

    if (lookupError) {
      console.error('Book lookup failed', lookupError);
      return lookupBooksClientFallback(normalized, mode);
    }

    return Array.isArray(data?.results) ? data.results : [];
  }, []);

  const createReadingAssignment = useCallback(async (draft: ReadingAssignmentDraft) => {
    if (!draft.book.title.trim()) throw new Error('Book title is required');

    const { data: bookRow, error: bookError } = await supabase
      .from('books')
      .insert(bookToRow(draft.book, currentUser.id))
      .select('*')
      .single();

    if (bookError) throw bookError;

    const { error: assignmentError } = await supabase
      .from('book_reading_assignments')
      .insert({
        book_id: bookRow.id,
        course_id: draft.courseId,
        assigned_by: currentUser.id,
        title: draft.title || draft.book.title,
        instructions: draft.instructions ?? null,
        due_date: draft.dueDate || null,
        status: draft.status,
      });

    if (assignmentError) throw assignmentError;
    await refetchBooks();
  }, [currentUser.id, refetchBooks]);

  const uploadBookCover = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileBase = safePathPart(file.name.replace(/\.[^.]+$/, ''));
    const path = [
      'books',
      'covers',
      currentUser.id,
      `${Date.now()}-${fileBase}.${extension}`,
    ].join('/');

    const { publicUrl } = await uploadFileToStorage({ file, path });
    return publicUrl;
  }, [currentUser.id]);

  const updateReadingAssignment = useCallback(async (
    assignmentId: number,
    updates: Partial<{
      title: string;
      instructions: string | null;
      dueDate: string | null;
      status: BookReadingAssignmentStatus;
    }>
  ) => {
    const { error: updateError } = await supabase
      .from('book_reading_assignments')
      .update({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.instructions !== undefined && { instructions: updates.instructions }),
        ...(updates.dueDate !== undefined && { due_date: updates.dueDate }),
        ...(updates.status !== undefined && { status: updates.status }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateError) throw updateError;
    await refetchBooks();
  }, [refetchBooks]);

  const deleteReadingAssignment = useCallback(async (assignmentId: number) => {
    const { error: deleteError } = await supabase
      .from('book_reading_assignments')
      .delete()
      .eq('id', assignmentId);
    if (deleteError) throw deleteError;
    await refetchBooks();
  }, [refetchBooks]);

  const upsertMySubmission = useCallback(async (
    assignmentId: number,
    input: {
      status: BookReadingSubmissionStatus;
      responseText?: string | null;
      responseUrl?: string | null;
    }
  ) => {
    const { error: upsertError } = await supabase
      .from('book_reading_submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: currentUser.id,
        status: input.status,
        response_text: input.responseText ?? null,
        response_url: input.responseUrl ?? null,
        submitted_at: input.status === 'submitted' || input.status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' });

    if (upsertError) throw upsertError;
    await refetchBooks();
  }, [currentUser.id, refetchBooks]);

  return {
    assignments,
    myAssignments,
    submissions,
    mySubmissions: submissions.filter(submission => submission.studentId === currentUser.id),
    loading,
    error,
    lookupBooks,
    uploadBookCover,
    createReadingAssignment,
    updateReadingAssignment,
    deleteReadingAssignment,
    upsertMySubmission,
    refetchBooks,
  };
}
