"use client";

import Link from "next/link";

export function Navbar() {
  return (
    <nav>
      <div>
        <Link href="/">OurATime</Link>
      </div>
      <ul>
        <li>
          <Link href="/login">Login</Link>
        </li>
        <li>
          <Link href="/signup">Sign Up</Link>
        </li>
      </ul>
    </nav>
  );
}
