import { Top } from "@toss/tds-mobile";
import type { PropsWithChildren, ReactNode } from "react";

interface PageScaffoldProps extends PropsWithChildren {
  title: ReactNode;
  subtitle?: ReactNode;
}

export function PageScaffold({ children, title, subtitle }: PageScaffoldProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Top
        title={<Top.TitleParagraph size={22}>{title}</Top.TitleParagraph>}
        subtitleBottom={
          subtitle === undefined ? undefined : (
            <Top.SubtitleParagraph size={17}>{subtitle}</Top.SubtitleParagraph>
          )
        }
      />
      <main
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 24px 32px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
