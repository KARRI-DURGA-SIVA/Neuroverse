import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { apiFetch } from "../../lib/api-client";

export default function CourseDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [course, setCourse] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/courses/${id}`)
      .then((result) => setCourse(result.course))
      .catch((requestError) => setError(requestError.message || "Could not load this course."));
  }, [id]);

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/courses" className="text-sm font-semibold text-accent-600">← Browse courses</Link>
        {error ? (
          <div role="alert" className="border-y border-red-200 py-8 text-sm text-red-700">{error}</div>
        ) : !course ? (
          <p className="py-8 text-sm text-ink-500">Loading course...</p>
        ) : (
          <article className="space-y-5">
            <header className="border-b border-gray-200 pb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{course.category} · {course.skill_name}</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink-900">{course.title}</h1>
              <p className="mt-2 text-sm text-ink-500">{course.mentor_level} mentor · {Number(course.price_per_hour).toFixed(1)} credits/hour</p>
            </header>
            <section>
              <h2 className="text-base font-semibold text-ink-900">About this course</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{course.description || "No course description provided."}</p>
            </section>
            <section className="border-y border-gray-200 py-4">
              <h2 className="text-base font-semibold text-ink-900">Mentor</h2>
              <p className="mt-1 text-sm text-ink-700">{course.mentor_name} · {Number(course.avg_rating || 0).toFixed(1)} rating ({Number(course.total_reviews || 0)} reviews)</p>
              {course.mentor_bio && <p className="mt-2 text-sm text-ink-500">{course.mentor_bio}</p>}
              {course.mentor_languages?.length > 0 && <p className="mt-2 text-xs text-ink-500">Languages: {course.mentor_languages.join(", ")}</p>}
              <p className="mt-2 text-xs text-ink-500">Availability: {course.availability_text || "Not listed; confirm with the mentor."}</p>
            </section>
            <Link href="/courses" className="btn-primary inline-flex text-sm">Choose a session time</Link>
          </article>
        )}
      </div>
    </Layout>
  );
}