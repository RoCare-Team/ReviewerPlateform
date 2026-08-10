import { MessageSquare } from "lucide-react";
import { requireAdmin } from "../../../../lib/auth/guards";
import dbConnect from "../../../../lib/db";
import Contact from "../../../../models/Contact";
import ContactsTable from "../../../../components/admin/ContactsTable";

export const metadata = { title: "Contact requests · Admin", robots: { index: false } };

export default async function AdminContactsPage() {
  await requireAdmin();
  await dbConnect();

  const contacts = await Contact.find({}).sort({ createdAt: -1 }).limit(500).lean();

  // Serialized for the client table — no ObjectIds or Dates cross the boundary.
  const rows = contacts.map((c) => ({
    id: String(c._id),
    name: c.name,
    email: c.email,
    phone: c.phone,
    description: c.description,
    date: new Date(c.createdAt).toLocaleString("en-IN"),
  }));

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Contact requests</h1>
          <p className="text-sm text-secondary">{rows.length} submitted via the "Book a demo" form</p>
        </div>
      </div>

      <ContactsTable rows={rows} />
    </div>
  );
}
