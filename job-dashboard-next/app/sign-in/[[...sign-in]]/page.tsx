import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] px-4">
      <div className="mb-8 text-center">
        <span className="font-bold text-2xl tracking-tight text-white">
          app<span style={{ color: "#86efac" }}>where</span><span style={{ color: "#86efac" }}>?</span>
        </span>
      </div>
      <SignIn
        redirectUrl="/dashboard"
        appearance={{
          variables: {
            colorBackground: "#0D0D0D",
            colorText: "#E7E7E7",
            colorTextSecondary: "#919191",
            colorInputBackground: "#1A1A1A",
            colorInputText: "#E7E7E7",
            colorPrimary: "#86efac",
            borderRadius: "0.75rem",
          },
          elements: {
            card: "border border-[#222] shadow-none",
            headerTitle: "text-white",
            headerSubtitle: "text-[#919191]",
            formButtonPrimary: "bg-[#86efac] text-[#080808] font-semibold hover:opacity-90",
            footerActionLink: "text-[#86efac] hover:text-[#86efac]/80",
          },
        }}
      />
    </div>
  )
}