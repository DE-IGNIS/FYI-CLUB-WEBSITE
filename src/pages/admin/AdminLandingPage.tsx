import React from 'react';

const ADMIN_QUEUE_URL = 'https://docs.google.com/spreadsheets/d/1fd4qfQUE-H2XNqw1VHq5IXD2KbSgeziT9zPe26XPsS8/edit';

export const AdminLandingPage: React.FC = () => (
  <main className="min-h-[70vh] bg-[#F6F3EB] text-[#111111] px-4 py-14 sm:px-8 font-mono">
    <section className="max-w-3xl mx-auto border-2 border-[#111111] bg-white p-6 sm:p-10 brutal-shadow">
      <p className="text-xs uppercase tracking-widest text-[#FF4800] font-bold">FYI / PRIVATE ADMIN</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-black uppercase">Team profile approvals</h1>
      <p className="mt-5 text-sm leading-relaxed">
        Review team profile submissions in the private approval sheet. Only accounts granted access to that Google Sheet can view or change submissions.
      </p>
      <a
        href={ADMIN_QUEUE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-block mt-7 bg-[#FF4800] text-white border-2 border-[#111111] px-5 py-3 text-xs font-bold uppercase"
      >
        Open approval sheet ↗
      </a>
    </section>
  </main>
);
