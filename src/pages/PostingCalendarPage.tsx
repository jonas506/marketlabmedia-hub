import AppLayout from "@/components/AppLayout";
import PostingCalendar from "@/components/PostingCalendar";

const PostingCalendarPage = () => {
  return (
    <AppLayout>
      <div className="space-y-1 mb-6">
        <h1 className="text-xl font-display font-bold">Posting-Kalender</h1>
        <p className="text-sm text-muted-foreground">Alle geplanten Posts über alle Kunden hinweg</p>
      </div>
      <PostingCalendar />
    </AppLayout>
  );
};

export default PostingCalendarPage;
