import { NextResponse } from "next/server";
import Contact from "@/models/Contact";
import dbConnect from "@/lib/db";

export async function POST(req) {
  try {
    // 1. Establish database connection
    await dbConnect();

    // 2. Parse request body
    const body = await req.json();
    const { name, email, phone, description } = body;

    // 3. Simple manual server-side validation
    if (!name || !email || !phone || !description) {
      return NextResponse.json(
        { success: false, error: "Please fill out all required fields." },
        { status: 400 }
      );
    }

    // 4. Create document in database
    const newContact = await Contact.create({
      name,
      email,
      phone,
      description,
    });

    return NextResponse.json(
      { 
        success: true, 
        message: "Data successfully saved", 
        data: newContact 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("API submission error:", error);

    // Mongoose validation errors check
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return NextResponse.json(
        { success: false, error: messages.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "An unexpected server error occurred." },
      { status: 500 }
    );
  }
}