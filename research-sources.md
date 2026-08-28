# 문제 맥락 확장 조사

이 문서는 문제은행의 주제와 상황 범위를 넓히기 위해 확인한 공식 자료와 적용 원칙을 기록합니다. 실제 문항의 문장, 선택지, 정답은 복제하지 않았습니다.

## 확인한 공식 자료

- [IELTS General Training sample test questions](https://www.ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test)
  - 생활 안내문, 정보 요청과 상황 설명 편지, 관점·논쟁·문제에 대한 글쓰기, 개인 경험에서 확장되는 말하기 맥락을 참고했습니다.
- [Cambridge English B2 First handbook](https://www.cambridgeenglish.org/images/167791-b2-first-handbook.pdf)
  - 사회·관광, 직장, 학업이라는 실제 사용 영역과 이메일·의견·이유 제시 능력을 참고했습니다.
- [Cambridge English C1 Advanced exam format](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/)
  - 신문·잡지·강의·인터뷰·토론·업무 대화, 그리고 목적과 독자가 명확한 이메일·제안·보고 맥락을 참고했습니다.
- [Pearson PTE Academic test format](https://www.pearsonpte.com/pte-academic/test-format/)
  - Speaking & Writing, Reading, Listening을 통합적으로 다루는 학업·전문 맥락을 참고했습니다.
- [Duolingo English Test readiness guide](https://blog.englishtest.duolingo.com/duolingo-english-test-readiness/)
  - 짧은 디지털 과제, 적응형 구성, 읽기·쓰기·듣기·말하기의 빠른 전환을 참고했습니다.
- [Duolingo Interactive Speaking](https://blog.englishtest.duolingo.com/interactive-speaking/)
  - 준비 시간 없는 실제 대화, 후속 질문, 설명·서술·논증의 말하기 목적을 참고했습니다.
- [ETS TOEFL Writing Scoring Guide](https://www.ets.org/content/dam/ets-org/pdfs/toefl/writing-rubrics.pdf)
  - 0–5점 기준의 과제 목적 지원, 내용 전개, 구문·어휘 범위, 정확성, 이메일의 공손성·격식·정보 조직 기준을 Writing 코칭에 반영했습니다.
- [ETS TOEFL iBT Test Specifications 2026](https://www.in.ets.org/content/dam/ets-org/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf)
  - Build a Sentence, Write an Email, Write for an Academic Discussion 구성과 문법 정확성·응집성·명료성·어조·논리적 전개 요구를 반영했습니다.
- [ETS TOEFL iBT Writing Section](https://www.ets.org/toefl/test-takers/ibt/about/content/writing.html)
  - Build a Sentence는 단어나 구를 배열해 완전하고 문법적인 문장 또는 질문을 만드는 과제라는 공식 설명을 반영했습니다.
- [ETS TOEFL iBT Teacher Resources Practice Test 1](https://www.ets.org/content/dam/ets-org/pdfs/toefl/toefl-ibt-teachers-resources-practice-test-1.pdf)
  - 공식 예시의 5–8개 정답 칸, 한 단어 또는 짧은 구 형태의 타일, 섞인 제시 순서, 일부 문항의 추가 방해 타일을 구현 기준으로 사용했습니다. 공식 문항의 문장 자체는 문제은행에 복제하지 않았습니다.
- [ETS Reading Vocabulary transcript](https://www.ets.org/toefl/test-takers/ibt/transcript/reading-vocabulary.html)
  - 여러 분야에서 공통으로 쓰이는 academic vocabulary와 지문 안에서 정의되는 specialized vocabulary를 구분했습니다. ETS가 직접 든 `arbitrary`, `capacity`, `fluctuate`, `relatively`를 학술 지문에 문맥적으로 배치했습니다.
- [Ollama Qwen 3.5 9B](https://ollama.com/library/qwen3.5:9b)
  - 16GB Apple Silicon에서 실행 가능한 6.6GB Q4_K_M 모델을 로컬 Writing 코치 기본값으로 선택했습니다.
- [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [Google Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3)
  - 4B 모델의 128K 문맥과 140개 이상 언어 지원을 전체 어휘의 독립 의미 검수 모델 선정 근거로 사용했습니다.
- [Ollama TranslateGemma](https://ollama.com/library/translategemma)
  - 두 일반 지시 모델이 번역에 동의하지 않거나 문자·길이 품질 검사를 통과하지 못한 의미만 다시 번역하는 전용 모델로 사용했습니다.
  - 기준별 점수, 오류, 수정 계획, 개선 답안을 안정적으로 분리하기 위해 JSON schema 출력을 사용했습니다.

## 적용 방식

기존 확장 묶음은 53개 주제마다 다음 14문항을 생성했습니다.

- 학술 Reading 2문항: 연구 결과와 한계
- 생활 Reading 2문항: 공지, 조치, 후속 절차
- 대화 Listening 2문항: 문제와 해결 과정
- 강의 Listening 2문항: 중심 주장과 주의점
- Writing 3문항: 문장 구성, 공식 이메일, 학술 토론
- Speaking 3문항: 문장 반복, 개인 경험, 근거 기반 판단

기존 1,000문항에 ETS 2026 명세에 맞춰 난이도를 유형별로 재조정한 20개 신규 주제·360문항을 더해 총 1,360문항으로 구성했습니다.

추가 20개 주제는 주제당 18문항입니다. Complete the Words 1, 학술 Reading 3, 생활 Reading 2, Listen and Choose a Response 1, 대화 Listening 2, 강의 Listening 2, Writing 3, Speaking 4문항으로 구성했습니다. 생활 안내·짧은 응답·이메일·짧은 따라 말하기는 전문 배경지식을 요구하지 않는 B1–B2 수준으로 제한했고, C1 어휘와 복잡한 내용은 학술 지문·강의에 집중했습니다. 학술 지문·강의도 항상 지문 안에서 필요한 맥락을 제공해 사전 전문지식이 없어도 풀 수 있게 했습니다.

Build a Sentence 93문항은 정답 순서와 별도로 선택 타일을 결정적으로 섞습니다. 정답은 5–8개의 타일로 구성하며 추가 20문항의 각 타일은 최대 2단어의 짧은 구로 제한했습니다. 공식 예시처럼 일부 문항에는 정답에 쓰이지 않는 방해 타일 하나를 포함합니다.

학술 Reading 생성 지문에는 `systematic`, `preliminary`, `constraint`, `qualify`, `subsequent`, `evaluate`, `persist` 등 여러 분야에서 재사용되는 학술 어휘를 연구 절차·결과 해석 문맥에 넣었습니다. 두 번째 Reading 문항은 이 가운데 한 단어의 문맥상 의미를 묻도록 바꿨습니다. 생활 안내·대화·강의·Academic Discussion에도 `implement`, `adverse`, `intervention`, `valid`, `constitute`, `tentative`, `definitive` 같은 어휘를 기능에 맞게 분산했습니다.
