import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db', 'favorites_db.json');

// Ensure DB exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([]));
}

export async function GET() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read favorites' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { keyword, action } = await req.json();
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    
    let newData = [...data];
    if (action === 'add' && !newData.includes(keyword)) {
      newData.push(keyword);
    } else if (action === 'remove') {
      newData = newData.filter(k => k !== keyword);
    }
    
    fs.writeFileSync(DB_PATH, JSON.stringify(newData, null, 2));
    return NextResponse.json({ success: true, count: newData.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update favorites' }, { status: 500 });
  }
}
