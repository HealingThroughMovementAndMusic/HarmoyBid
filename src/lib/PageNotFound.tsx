import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4" dir="rtl">
      <h1 className="text-4xl font-extrabold text-primary">404</h1>
      <p className="text-muted-foreground">הדף שחיפשת לא נמצא</p>
      <Link to="/" className="text-primary underline text-sm font-semibold">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
