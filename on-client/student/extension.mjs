// 이 파일は学生が同じプロジェクトで 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('div');
      const deviceStatusLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionStatusLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const modeLabels = {
        connected: '연결됨',
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const modeText = (mode) => Object.hasOwn(modeLabels, mode) ? modeLabels[mode] : modeLabels.unknown;
      const addText = (parent, tag, text) => {
        const node = document.createElement(tag);
        node.textContent = text;
        parent.append(node);
        return node;
      };
      const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
      const isString = (value) => typeof value === 'string';
      const validIdentity = (resource) => isRecord(resource?.data)
        && isRecord(resource.data.user) && isString(resource.data.user.label) && isString(resource.data.user.id)
        && isRecord(resource.data.device) && isString(resource.data.device.label) && isString(resource.data.device.id)
        && Object.hasOwn(deviceStatusLabels, resource.data.device.status)
        && isRecord(resource.data.session) && isString(resource.data.session.id)
        && Object.hasOwn(sessionStatusLabels, resource.data.session.status);
      const validDevices = (resource) => Array.isArray(resource?.data)
        && resource.data.every((item) => isRecord(item) && isString(item.id) && isString(item.label)
          && Object.hasOwn(deviceStatusLabels, item.status));
      const validSessions = (resource) => Array.isArray(resource?.data)
        && resource.data.every((item) => isRecord(item) && isString(item.id)
          && Object.hasOwn(sessionStatusLabels, item.status));
      const statusText = (labels, value) => Object.hasOwn(labels, value)
        ? `${labels[value]} (${value})`
        : '확인 불가';

      const renderResource = (title, resource, renderData, validate) => {
        const section = document.createElement('section');
        addText(section, 'h3', title);
        addText(section, 'p', `연결 모드: ${modeText(resource?.mode)}`);

        if (!isRecord(resource)) {
          addText(section, 'p', '확인 불가 (응답 형식 확인 불가)');
        } else if (resource.status === 'loading') {
          addText(section, 'p', '불러오는 중');
        } else if (resource.status === 'error') {
          const message = resource.error && isRecord(resource.error) ? resource.error.message : null;
          addText(section, 'p', isString(message) && message.trim()
            ? `연결 실패: ${message}`
            : '확인 불가 (응답 형식 확인 불가)');
        } else if (resource.status !== 'ok' || !validate(resource)) {
          addText(section, 'p', '확인 불가 (응답 형식 확인 불가)');
        } else {
          renderData(section, resource.data);
        }

        root.append(section);
      };

      renderResource('로그인 사용자·기기·세션', me, (section, data) => {
        addText(section, 'p', `사용자 이름: ${data.user.label || '정보 없음'}`);
        addText(section, 'p', `사용자 ID: ${data.user.id}`);
        addText(section, 'p', `기기 이름: ${data.device.label || '정보 없음'}`);
        addText(section, 'p', `기기 ID: ${data.device.id}`);
        addText(section, 'p', `기기 상태: ${statusText(deviceStatusLabels, data.device.status)}`);
        addText(section, 'p', `세션 ID: ${data.session.id}`);
        addText(section, 'p', `세션 상태: ${statusText(sessionStatusLabels, data.session.status)}`);
      }, validIdentity);

      renderResource('기기 목록', devices, (section, list) => {
        if (list.length === 0) {
          addText(section, 'p', '표시할 기기가 없습니다.');
          return;
        }
        for (const item of list) {
          addText(section, 'p', `기기 이름: ${item.label || '정보 없음'} · 기기 ID: ${item.id} · 상태: ${statusText(deviceStatusLabels, item.status)}`);
        }
      }, validDevices);

      renderResource('세션 목록', sessions, (section, list) => {
        if (list.length === 0) {
          addText(section, 'p', '표시할 세션이 없습니다.');
          return;
        }
        for (const item of list) {
          addText(section, 'p', `세션 ID: ${item.id} · 상태: ${statusText(sessionStatusLabels, item.status)}`);
        }
      }, validSessions);

      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
