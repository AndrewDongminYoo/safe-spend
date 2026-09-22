import { Top } from "@toss/tds-mobile";

function App() {
  return (
    <>
      <Top
        title={
          <Top.TitleParagraph size={22}>
            다음 수입일까지 써도 되는 돈
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={17}>
            고정지출을 먼저 빼고, 오늘의 여유를 확인해요.
          </Top.SubtitleParagraph>
        }
      />
    </>
  );
}

export default App;
