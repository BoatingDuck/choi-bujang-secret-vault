// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
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

    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('div');

      const addText = (message) => {
        const p = document.createElement('p');
        p.textContent = message;
        root.append(p);
      };

      const decisionLabels = {
        allow: '접근 허용',
        deny: '접근 거부',
        challenge: '추가 인증 또는 확인 필요',
        unknown: '판정 확인 불가',
      };

      const modeLabels = {
        connected: '연결됨',
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };

      if (typeof appId === 'string' && appId.trim()) {
        addText(`요청한 업무 앱 ID: ${appId}`);
      }

      if (mode != null) {
        const modeLabel = Object.hasOwn(modeLabels, mode)
          ? modeLabels[mode]
          : '확인 불가';
        addText(`연결 모드: ${modeLabel}`);
      }

      if (status === 'idle') {
        addText('업무 앱을 선택한 뒤 접속을 요청하세요.');
        return root;
      }

      if (status === 'loading') {
        addText('판정 확인 중');
        return root;
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string'
          && error.message.trim()
          ? error.message
          : '오류 내용을 확인할 수 없습니다.';

        addText(`접근 요청 실패: ${message}`);
        addText('요청 실패는 접근 거부(deny) 판정이 아닙니다.');
        return root;
      }

      if (status !== 'ok'
        || !data
        || typeof data !== 'object'
        || Array.isArray(data)) {
        addText('판정 확인 불가 (unknown)');
        return root;
      }

      if (typeof data.appId !== 'string'
        || !data.appId.trim()
        || (typeof appId === 'string'
          && appId.trim()
          && data.appId !== appId)) {
        addText('판정 확인 불가 (unknown)');
        addText('요청한 업무 앱의 판정인지 확인할 수 없습니다.');
        return root;
      }

      addText(`판정 대상 앱 ID: ${data.appId}`);

      const decision = Object.hasOwn(decisionLabels, data.decision)
        ? data.decision
        : 'unknown';

      const reason = typeof data.reason === 'string' && data.reason.trim()
        ? data.reason
        : '확인 불가';

      const checkedAt = typeof data.checkedAt === 'string'
        && data.checkedAt.trim()
        ? data.checkedAt
        : '확인 불가';

      if (reason === '확인 불가' || checkedAt === '확인 불가') {
        addText('판정 확인 불가 (unknown)');
        addText(`판정 이유: ${reason}`);
        addText(`판정 시각: ${checkedAt}`);
        return root;
      }

      addText(`접근 판정: ${decisionLabels[decision]} (${decision})`);
      addText(`판정 이유: ${reason}`);
      addText(`판정 시각: ${checkedAt}`);

      if (decision === 'allow') {
        addText('정책상 접근 허용이며 실제 앱 접속 성공을 보장하지 않습니다.');
      } else if (decision === 'challenge') {
        addText('추가 확인이 필요합니다. 이 앱은 인증 절차를 대신 수행하지 않습니다.');
      } else if (decision === 'unknown') {
        addText('접근 허용 여부를 확인할 수 없습니다.');
      }

      return root;
    },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
