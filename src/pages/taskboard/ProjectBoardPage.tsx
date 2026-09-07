import { Navigate, useParams, useSearchParams } from 'react-router-dom';

/** Legacy route — redirect to expandable overview. */
export default function ProjectBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const task = searchParams.get('task');
  const query = task ? `?open=${slug}&task=${task}` : `?open=${slug}`;
  return <Navigate to={`/taskboard${query}`} replace />;
}
