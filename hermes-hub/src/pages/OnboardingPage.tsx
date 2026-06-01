export default function OnboardingPage() {
  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden" }}>
      <iframe
        src="http://127.0.0.1:3100/onboarding"
        className="flex-1 w-full border-0"
        style={{ minHeight: 0 }}
        title="Onboarding"
      />
    </div>
  );
}
