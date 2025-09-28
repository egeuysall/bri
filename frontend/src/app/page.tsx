const Landing: React.FC = () => {
  return (
    <main className="flex flex-col gap-2xs">
      <h1>Welcome to Bridge!</h1>
      <p className="md:w-3/4 lg:w-1/2 text-neutral-700 dark:text-neutral-300">
        Share your Markdown files quickly and easily. Upload a file or paste your
        Markdown and get a clean, shareable link instantly. No accounts needed, no clutter, just
        simple Markdown sharing.
      </p>
    </main>
  );
};

export default Landing;
