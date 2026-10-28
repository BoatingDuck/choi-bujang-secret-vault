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

    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('div');
      const addText = (parent, tag, message) => {
        const element = document.createElement(tag);
        element.textContent = message;
        parent.append(element);
        return element;
      };

      const kindLabels = {
        access: '접속 기록',
        xdr: 'XDR 경보',
      };
      const accessLabels = {
        allowed: '접근 허용',
        denied: '접근 거부',
        unknown: '확인 불가',
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const stateText = (labels, value) => Object.hasOwn(labels, value)
        ? `${labels[value]}(${value})`
        : '확인 불가(unknown)';
      const appText = (appId) => appId == null || appId === ''
        ? '앱 확인 불가(appId 없음)'
        : appId;

      if (mode === 'demo') {
        addText(root, 'p', '예제 자료');
      } else if (mode === 'disconnected') {
        addText(root, 'p', '연결 없음');
      } else if (mode === 'unknown') {
        addText(root, 'p', '확인 불가');
      }

      if (status === 'loading') {
        addText(root, 'p', '기록을 불러오는 중');
        return root;
      }

      if (status === 'error') {
        const message = typeof error?.message === 'string' && error.message.trim()
          ? error.message
          : '오류 정보를 확인할 수 없습니다.';
        if (error?.code === 'CONTRACT_MISMATCH') {
          addText(root, 'p', `기록 확인 불가(응답 형식 불일치): ${message}`);
        } else {
          addText(root, 'p', `기록을 불러오지 못했습니다: ${message}`);
        }
        return root;
      }

      if (status !== 'ok' || !Array.isArray(data)) {
        addText(root, 'p', '기록을 확인할 수 없습니다.');
        return root;
      }

      addText(root, 'p', '현재 사용자에게 전달된 최근 보안 기록(최대 40건)만 표시합니다. 전체 이력이나 실시간 전체 위협 탐지가 아닙니다.');

      if (data.length === 0) {
        addText(root, 'p', '표시할 기록이 없습니다.');
        return root;
      }

      // 서버에서 전달받은 원본 배열은 수정하지 않는다.
      const sortedEvents = [...data].sort(
        (a, b) => Date.parse(b.at) - Date.parse(a.at)
      );

      // 선택지는 전달받은 실제 값만 사용하고, all은 필터 해제 용도로만 쓴다.
      const filterBar = document.createElement('div');
      const createFilter = (labelText, values) => {
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        select.setAttribute('aria-label', labelText);

        const addOption = (value, caption) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = caption;
          select.append(option);
        };

        addOption('all', '전체');
        for (const value of new Set(values)) {
          if (typeof value === 'string' && value !== '' && value !== 'all') {
            addOption(value, value);
          }
        }
        select.value = 'all';
        label.append(select);
        filterBar.append(label);
        return select;
      };

      const kindFilter = createFilter('기록 종류', sortedEvents.map(event => event.kind));
      const appFilter = createFilter('업무 앱', sortedEvents.map(event => event.appId));
      const accessFilter = createFilter('접속 상태', sortedEvents.map(event => event.state.access));
      root.append(filterBar);

      const countText = document.createElement('p');
      countText.setAttribute('aria-live', 'polite');
      root.append(countText);
      const list = document.createElement('ul');
      root.append(list);

      // 이 함수 호출이 새 자료를 받을 때마다 새 DOM을 생성한다.
      // 따라서 이전 목록·필터·상세 선택은 다시 불러온 화면에 남지 않는다.
      let openDetail = null;
      let openButton = null;

      const closeDetail = () => {
        if (openDetail) openDetail.remove();
        if (openButton) openButton.setAttribute('aria-expanded', 'false');
        openDetail = null;
        openButton = null;
      };

      const toggleDetail = (event, row, button) => {
        const wasOpen = openButton === button;
        closeDetail();
        if (wasOpen) return;

        const detail = document.createElement('div');
        detail.setAttribute('data-student-event-detail', event.id);
        addText(detail, 'h4', `사건 상세: ${event.id}`);
        addText(detail, 'p', `사건 ID: ${event.id}`);
        addText(detail, 'p', `앱 ID: ${appText(event.appId)}`);
        addText(detail, 'p', `시각: ${event.at}`);

        addText(detail, 'h5', '근거(evidence)');
        if (Array.isArray(event.evidence) && event.evidence.length > 0) {
          const evidenceList = document.createElement('ul');
          for (const item of event.evidence) {
            addText(evidenceList, 'li', `근거 ID: ${item.id} · 내용: ${item.text}`);
          }
          detail.append(evidenceList);
        } else {
          addText(detail, 'p', '표시할 근거가 없습니다.');
        }

        addText(detail, 'h5', '규칙(rules)');
        if (Array.isArray(event.rules) && event.rules.length > 0) {
          const ruleList = document.createElement('ul');
          for (const item of event.rules) {
            addText(ruleList, 'li', `규칙 ID: ${item.id} · 내용: ${item.text}`);
          }
          detail.append(ruleList);
        } else {
          addText(detail, 'p', '표시할 규칙이 없습니다.');
        }

        const eventState = event.state ?? {};
        addText(detail, 'h5', '사건 당시 상태');
        addText(detail, 'p', `접속 상태(access): ${stateText(accessLabels, eventState.access)}`);
        addText(detail, 'p', `세션 상태(session): ${stateText(sessionLabels, eventState.session)}`);
        addText(detail, 'p', `기기 상태(device): ${stateText(deviceLabels, eventState.device)}`);
        // 현재 실제 목록은 supportedActions가 비어 있다. 값이 오더라도 이 단계에서는 실행하지 않는다.
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          const actions = event.supportedActions.filter(
            action => typeof action === 'string' && action.trim() !== ''
          );
          if (actions.length > 0) {
            addText(detail, 'h5', '미지원 조치');
            addText(detail, 'p', '조치 실행 연결은 준비 중입니다. 다음 버튼은 요청을 보내지 않습니다.');
            for (const action of actions) {
              const unsupportedButton = document.createElement('button');
              unsupportedButton.type = 'button';
              unsupportedButton.textContent = `${action} 미지원`;
              unsupportedButton.disabled = true;
              detail.append(unsupportedButton);
            }
          }
        }

        row.append(detail);
        button.setAttribute('aria-expanded', 'true');
        openDetail = detail;
        openButton = button;
      };

      const renderFilteredEvents = () => {
        // 필터가 바뀌면 이전 상세 선택을 해제하고 목록을 새로 만든다.
        openDetail = null;
        openButton = null;
        list.replaceChildren();

        const filtered = sortedEvents.filter(event =>
          (kindFilter.value === 'all' || event.kind === kindFilter.value) &&
          (appFilter.value === 'all' || event.appId === appFilter.value) &&
          (accessFilter.value === 'all' || event.state.access === accessFilter.value)
        );

        countText.textContent = `표시 중인 기록: ${filtered.length}건 / 전달받은 기록 ${sortedEvents.length}건`;
        if (filtered.length === 0) {
          addText(list, 'li', '필터 조건에 맞는 기록이 없습니다.');
          return;
        }

        for (const event of filtered) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', event.id);
          const kind = Object.hasOwn(kindLabels, event.kind)
            ? `${kindLabels[event.kind]}(${event.kind})`
            : '확인 불가';
          addText(row, 'p',
            `사건 ID: ${event.id} · 시각: ${event.at} · 종류: ${kind} · ` +
            `앱: ${appText(event.appId)} · 요약: ${event.summary}`
          );

          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.setAttribute('aria-expanded', 'false');
          button.addEventListener('click', () => toggleDetail(event, row, button));
          row.append(button);
          list.append(row);
        }
      };

      kindFilter.addEventListener('change', renderFilteredEvents);
      appFilter.addEventListener('change', renderFilteredEvents);
      accessFilter.addEventListener('change', renderFilteredEvents);
      renderFilteredEvents();

      return root;
    },

    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('div');
      const addText = (parent, tag, message) => {
        const element = document.createElement(tag);
        element.textContent = message;
        parent.append(element);
        return element;
      };
      const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionLabels = {
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
      const stateText = (labels, value) => Object.hasOwn(labels, value)
        ? `${labels[value]}(${value})`
        : '확인 불가(unknown)';

      // 입력은 제공 UI가 정제한 자료다. 비밀처럼 보이는 문자열은 다시 노출하지 않는다.
      const possibleSecret = /(?:\bBearer\s+\S+|\b(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]|sk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
      const safeMessage = value => typeof value === 'string' && value.trim()
        ? (possibleSecret.test(value) ? '민감정보가 포함될 수 있어 메시지를 표시하지 않습니다.' : value)
        : '오류 내용을 확인할 수 없습니다.';
      const safeCode = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value)
        ? value : 'UNKNOWN';
      const addRetry = (section, forDiagnostics = false) => {
        addText(section, 'p', forDiagnostics
          ? '다시 시도는 위쪽 「도움정보 불러오기」 버튼을 직접 누르세요. 자동으로 재요청하지 않습니다.'
          : '다시 시도는 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 자동으로 재요청하지 않습니다.');
      };
      const renderResource = (name, resource, labels, isDevice) => {
        const section = document.createElement('section');
        addText(section, 'h3', name);
        root.append(section);
        if (!isRecord(resource)) {
          addText(section, 'p', `${name} 정보를 확인할 수 없습니다.`);
          return;
        }
        if (resource.status === 'loading') {
          addText(section, 'p', `${name} 정보를 불러오는 중`);
          return;
        }
        if (resource.status === 'error') {
          const code = safeCode(resource.error?.code);
          addText(section, 'p', `${name} 정보를 불러오지 못했습니다: ${safeMessage(resource.error?.message)}`);
          if (/TIMEOUT|TIMED_OUT|DEADLINE/i.test(code)
            || /시간\s*초과/.test(String(resource.error?.message || ''))) {
            addText(section, 'p', '요청 시간이 초과되었습니다.');
          }
          addRetry(section);
          return;
        }
        if (resource.status !== 'ok' || !Array.isArray(resource.data)) {
          addText(section, 'p', `${name} 정보를 확인할 수 없습니다.`);
          return;
        }
        if (resource.data.length === 0) {
          addText(section, 'p', isDevice ? '등록된 기기가 없습니다.' : '현재 연결이 없습니다.');
          return;
        }
        const list = document.createElement('ul');
        for (const item of resource.data) {
          const rawStatus = item?.status;
          if (isDevice) {
            addText(list, 'li', `기기: ${typeof item?.label === 'string' && item.label ? item.label : '정보 없음'} · 상태: ${stateText(labels, rawStatus)}`);
          } else {
            addText(list, 'li', `세션 ID: ${typeof item?.id === 'string' ? item.id : '확인 불가'} · 상태: ${stateText(labels, rawStatus)}`);
          }
        }
        section.append(list);
      };

      if (mode != null) {
        addText(root, 'p', `연결 모드: ${Object.hasOwn(modeLabels, mode) ? modeLabels[mode] : '확인 불가'}`);
      }
      addText(root, 'p', '기기 조회는 현재 등록된 본인 기기 최대 100개를 대상으로 합니다.');
      renderResource('기기', devices, deviceLabels, true);
      addText(root, 'p', '세션 조회는 현재 검증된 연결 한 개만 대상으로 하며 지난 세션 전체 목록이 아닙니다.');
      renderResource('세션', sessions, sessionLabels, false);

      const alertSection = document.createElement('section');
      addText(alertSection, 'h3', '알림');
      if (Array.isArray(notifications) && notifications.length === 0) {
        addText(alertSection, 'p', '주의할 알림이 없습니다.');
      } else if (Array.isArray(notifications)) {
        const items = document.createElement('ul');
        for (const notice of notifications) {
          addText(items, 'li',
            `자료(resource): ${safeCode(notice?.resource)} · ` +
            `코드(code): ${safeCode(notice?.code)} · ` +
            `내용(message): ${safeMessage(notice?.message)}`);
        }
        alertSection.append(items);
      } else {
        addText(alertSection, 'p', '알림 목록을 확인할 수 없습니다.');
      }
      root.append(alertSection);

      const diagSection = document.createElement('section');
      addText(diagSection, 'h3', '진단 정보');
      root.append(diagSection);
      // 복사는 server/API 요청이 아니라 사용자가 누를 때만 브라우저 클립보드에 쓴다.
      // 허용된 여섯 항목 이외의 server data나 meta는 사용하지 않는다.
      let copyText = null;
      if (!isRecord(diagnostics)) {
        addText(diagSection, 'p', '진단 정보를 확인할 수 없습니다.');
      } else if (diagnostics.status === 'idle') {
        addText(diagSection, 'p', '진단 정보 조회 전입니다. 위쪽 「도움정보 불러오기」 버튼을 누르세요.');
      } else if (diagnostics.status === 'loading') {
        addText(diagSection, 'p', '진단 정보를 불러오는 중');
      } else if (diagnostics.status === 'error') {
        const code = safeCode(diagnostics.error?.code);
        addText(diagSection, 'p', `진단 정보를 불러오지 못했습니다: ${safeMessage(diagnostics.error?.message)}`);
        if (/TIMEOUT|TIMED_OUT|DEADLINE/i.test(code)
          || /시간\s*초과/.test(String(diagnostics.error?.message || ''))) {
          addText(diagSection, 'p', '요청 시간이 초과되었습니다.');
        }
        addRetry(diagSection, true);
      } else if (diagnostics.status === 'ok' && isRecord(diagnostics.data)
        && isRecord(diagnostics.data.engine)) {
        const data = diagnostics.data;
        const field = value => {
          if ((typeof value !== 'string' && typeof value !== 'number') || String(value).length > 150) {
            return '확인 불가';
          }
          const s = String(value);
          return possibleSecret.test(s) ? '민감정보 제외' : s;
        };
        const safe = {
          requestId: field(data.requestId),
          component: field(data.component),
          version: field(data.version),
          checkedAt: field(data.checkedAt),
          engine: {
            mode: field(data.engine.mode),
            code: field(data.engine.code),
          },
        };
        for (const key of ['requestId', 'component', 'version', 'checkedAt']) {
          addText(diagSection, 'p', `${key}: ${safe[key]}`);
        }
        addText(diagSection, 'p', `engine.mode: ${safe.engine.mode}`);
        addText(diagSection, 'p', `engine.code: ${safe.engine.code}`);
        copyText = JSON.stringify(safe, null, 2);
      } else {
        addText(diagSection, 'p', '진단 정보 형식을 확인할 수 없습니다.');
      }

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = '도움정보 복사';
      copyButton.disabled = copyText === null;
      diagSection.append(copyButton);
      addText(diagSection, 'p', '위의 비밀 없는 진단 정보만 도움 요청에 사용할 수 있도록 복사합니다.');
      const feedback = addText(diagSection, 'p', '');
      copyButton.addEventListener('click', async () => {
        if (copyText === null) return;
        try {
          if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
            throw new Error('CLIPBOARD_UNAVAILABLE');
          }
          await navigator.clipboard.writeText(copyText);
          feedback.textContent = '진단 정보를 복사했습니다.';
        } catch {
          feedback.textContent = '복사할 수 없습니다. 브라우저의 클립보드 권한을 확인하세요.';
        }
      });

      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status = 'idle', mode, data, error, checkedAt } = {}) {
      const root = document.createElement('section');
      const addText = (message) => {
        const p = document.createElement('p');
        p.textContent = message;
        root.append(p);
      };
      const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

      // 제공 앱의 연결 모드는 AI 모델 응답과 사건 설명 실행 상태가 아니다.
      if (mode === 'demo') addText('연결 모드: 예제 데이터(demo). 실제 AI 게이트 연결이나 권한 확인이 아닙니다.');
      else if (mode === 'disconnected') addText('연결 모드: 연결 없음');
      else if (mode === 'unknown') addText('연결 모드: 확인 불가');

      if (status === 'idle') {
        addText('AI 연결 점검 전');
        addText('이전 점검 결과는 현재 결과가 아닙니다. 「현재 API 연결 점검」 버튼을 직접 눌러 확인하세요.');
        return root;
      }
      if (status === 'loading') {
        addText('AI 연결 점검 중');
        addText('모델 응답을 확인하는 중입니다. 사건 설명을 실행하는 단계가 아닙니다.');
        return root;
      }
      if (status === 'ok') {
        if (!isRecord(data) || data.transportChecked !== true
          || !['test', 'verified'].includes(data.audienceAuthorization)
          || !Number.isInteger(data.modelCount) || data.modelCount < 0
          || typeof checkedAt !== 'string' || checkedAt.length > 64
          || !/^\d{4}-\d{2}-\d{2}T/.test(checkedAt)
          || Number.isNaN(Date.parse(checkedAt))) {
          addText('AI 연결 점검 결과 확인 불가: 응답 형식을 확인할 수 없습니다.');
          return root;
        }
        addText(data.audienceAuthorization === 'test'
          ? '시험 연결 점검(test): 모델 응답 확인이며 실제 앱 권한 검증은 아닙니다.'
          : '앱 권한 확인 후 점검(verified): 점검 시각 기준 앱 권한과 모델 응답을 확인했습니다.');
        addText('응답 모델 수(modelCount): ' + data.modelCount);
        addText('점검 시각(checkedAt): ' + checkedAt);
        if (data.modelCount === 0) addText('현재 응답 모델 수가 0개입니다. 담당자에게 모델 허용 설정을 확인하세요.');
        addText('사건 설명은 아직 실행하지 않았습니다. 실제 보안 기록에서 별도로 사건 설명을 요청하고 결과를 확인하세요.');
        return root;
      }
      if (status === 'error') {
        // 알려진 안전 코드에 대한 고정 문구만 표시한다. 원문 오류와 열쇠는 출력하지 않는다.
        const errors = {
          ON_AI_PROVISIONING_PENDING: ['학생 앱 이용 권한의 발급·연결을 준비 중입니다.', '담당자에게 계정 연결 및 앱 권한 확인을 요청하세요.'],
          WB_CLCO_AUTH_REQUIRED: ['앱 전용 인증이 필요합니다.', '계정 연결을 다시 확인하고 필요하면 담당자에게 문의하세요.'],
          WB_CLCO_ACCESS_BLOCKED: ['학생 앱의 AI 접근이 제한되었습니다.', '담당자에게 앱 이용 권한과 접근 제한 상태를 확인하세요.'],
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: ['반의 AI 사용량이 소진되었습니다.', '담당자에게 반 사용량 확인을 요청하세요.'],
          WB_CLCO_LIMIT_REACHED: ['AI 이용 한도에 도달했습니다.', '담당자에게 이용 한도 확인을 요청하세요.'],
          WB_CLCO_SESSION_CLOSED: ['현재 AI 이용 시간이 아닙니다.', '이용 가능 시간을 확인하세요.'],
          WB_CLCO_RATE_LIMITED: ['AI 요청이 일시적으로 제한되었습니다.', '잠시 후 「현재 API 연결 점검」 버튼을 직접 눌러 다시 확인하세요.'],
          WB_CLCO_TIMEOUT: ['AI 응답 시간이 초과되었습니다.', '잠시 후 버튼을 직접 눌러 다시 점검하세요.'],
          REQUEST_TIMEOUT: ['서버의 AI 요청 시간이 초과되었습니다.', '잠시 후 버튼을 직접 눌러 다시 점검하세요.'],
          ENGINE_TIMEOUT: ['서버의 확인 시간이 초과되었습니다.', '잠시 후 버튼을 직접 눌러 다시 점검하세요.'],
          TIMEOUT: ['AI 응답 시간이 초과되었습니다.', '잠시 후 버튼을 직접 눌러 다시 점검하세요.'],
          WB_CLCO_CANCELLED: ['AI 요청이 취소되었습니다.', '취소 전 결과는 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.'],
          CANCELLED: ['AI 요청이 취소되었습니다.', '취소 전 결과는 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.'],
          REQUEST_CANCELLED: ['AI 요청이 취소되었습니다.', '취소 전 결과는 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.'],
          MODEL_NOT_CONFIGURED: ['사용 가능한 AI 모델이 설정되지 않았습니다.', '담당자에게 모델 허용 설정을 확인하세요.'],
          ON_AI_MODEL_LIST_EMPTY: ['현재 앱 권한으로 사용할 수 있는 AI 모델이 없습니다.', '담당자에게 모델 허용 설정을 확인하세요.'],
          ON_AI_AUTHORIZATION_CHANGED: ['점검 도중 AI 이용 권한이 변경되었습니다.', '담당자에게 현재 앱 권한을 확인한 뒤 직접 다시 점검하세요.'],
          SUBJECT_SCOPE_UNVERIFIED: ['현재 계정의 사건·프로젝트 접근 범위를 확인할 수 없습니다.', '계정 연결 및 앱 권한을 담당자에게 확인하세요.'],
          ON_AI_INVALID_INPUT: ['AI 요청 입력을 확인할 수 없습니다.', '담당자에게 요청 정보 확인을 요청하세요.'],
          ON_AI_INVALID_OUTPUT: ['AI 응답 형식을 확인할 수 없습니다.', '기존 기록을 유지하고 담당자에게 확인하세요.'],
          AI_REQUEST_UNVERIFIED: ['AI 연결 또는 응답을 확인할 수 없습니다.', '담당자에게 계정 연결 및 앱 권한을 확인하세요.'],
        };
        const code = typeof error?.code === 'string' && Object.hasOwn(errors, error.code)
          ? error.code : 'AI_REQUEST_UNVERIFIED';
        addText('AI 연결 점검 실패 · 오류 코드(code): ' + code);
        addText('오류 메시지(message): ' + errors[code][0]);
        addText('안내: ' + errors[code][1]);
        addText('실패한 점검으로 사건 설명 성공을 판단할 수 없습니다. 자동 재점검은 실행하지 않습니다.');
        return root;
      }
      addText('AI 연결 상태를 확인할 수 없습니다.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('section');
      const addText = (parent, tag, message) => {
        const element = document.createElement(tag);
        element.textContent = message;
        parent.append(element);
        return element;
      };
      const show = (message) => addText(root, 'p', message);
      const validId = (value) => typeof value === 'string'
        && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value);
      const possibleSecret = /(?:\bBearer\s+\S+|sk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|비밀번호|토큰)\s*[:=]\s*\S+)/i;
      const safeText = (value, limit) => typeof value === 'string' && value.trim().length > 0
        && value.length <= limit && !possibleSecret.test(value)
        && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
      const status = explanation?.status;

      if (status === 'error') {
        const messages = {
          ON_AI_PROVISIONING_PENDING: '학생 앱 AI 이용 권한을 준비 중입니다. 담당자에게 확인하세요.',
          WB_CLCO_AUTH_REQUIRED: '인증이 필요합니다. 계정 연결과 앱 권한을 확인하세요.',
          WB_CLCO_ACCESS_BLOCKED: '접근이 제한되었습니다. 담당자에게 앱 권한을 확인하세요.',
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진되었습니다. 담당자에게 확인하세요.',
          WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.',
          WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
          WB_CLCO_RATE_LIMITED: 'AI 요청이 제한되었습니다. 필요할 때 직접 다시 요청하세요.',
          WB_CLCO_TIMEOUT: 'AI 요청 시간이 초과되었습니다.',
          REQUEST_TIMEOUT: '서버의 AI 응답 시간이 초과되었습니다.',
          ENGINE_TIMEOUT: '서버의 확인 시간이 초과되었습니다.',
          TIMEOUT: 'AI 응답 시간이 초과되었습니다.',
          WB_CLCO_CANCELLED: 'AI 사건 설명 요청이 취소되었습니다.',
          CANCELLED: 'AI 사건 설명 요청이 취소되었습니다.',
          REQUEST_CANCELLED: 'AI 사건 설명 요청이 취소되었습니다.',
          MODEL_NOT_CONFIGURED: '사용 가능한 AI 모델이 설정되지 않았습니다.',
          ON_AI_MODEL_LIST_EMPTY: '앱에서 사용할 수 있는 AI 모델이 없습니다.',
          ON_AI_AUTHORIZATION_CHANGED: 'AI 앱 권한이 변경되었습니다.',
          SUBJECT_SCOPE_UNVERIFIED: '현재 계정의 사건 접근 범위를 확인할 수 없습니다.',
          ON_AI_INVALID_INPUT: '설명에 필요한 사건 근거 또는 규칙이 부족하거나 유효하지 않습니다.',
          ON_AI_INVALID_OUTPUT: 'AI 응답의 형식 또는 근거 연결을 검증하지 못했습니다.',
          AI_REQUEST_UNVERIFIED: 'AI 사건 설명 요청 결과를 확인할 수 없습니다.',
        };
        const rawCode = explanation?.error?.code;
        const code = typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(rawCode)
          ? rawCode : 'AI_REQUEST_UNVERIFIED';
        const message = safeText(explanation?.error?.message, 500)
          ? explanation.error.message
          : (messages[code] || messages.AI_REQUEST_UNVERIFIED);
        show(`AI 설명 실패 · 오류 코드(code): ${code}`);
        show(`오류 메시지(message): ${message}`);
        if (code === 'ON_AI_INVALID_INPUT') {
          show('사건의 근거 또는 규칙이 부족해 설명을 요청할 수 없습니다.');
        } else if (code === 'ON_AI_INVALID_OUTPUT') {
          show('근거가 맞지 않거나 조치가 이미 실행됐다고 주장하는 등 검증을 통과하지 못한 AI 설명은 사용할 수 없습니다.');
        }
        show('보안 기록은 그대로 유지됩니다. AI 설명 실패는 과제 실패를 뜻하지 않습니다.');
        return root;
      }

      if (!event) {
        show('보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }
      if (status === 'loading') {
        show('선택한 보안 사건의 AI 설명을 요청하는 중입니다.');
        return root;
      }
      if (status === 'idle' || status == null) {
        show('AI 사건 설명 요청 전입니다.');
        return root;
      }
      if (status !== 'ok') {
        show('AI 사건 설명 상태를 확인할 수 없습니다.');
        return root;
      }

      const fail = (reason) => {
        show(`AI 설명 사용 불가: ${reason}`);
        show('기존 보안 기록은 그대로 유지됩니다.');
        return root;
      };
      const data = explanation.data;
      if (!validId(event.id) || !data || !safeText(data.summary, 1500)) {
        return fail('사건 ID 또는 설명 응답을 확인할 수 없습니다.');
      }
      if (data.executed !== false) {
        return fail(data.executed === true
          ? 'AI가 조치를 이미 실행했다고 답한 설명은 사용할 수 없습니다.'
          : '조치 미실행 여부를 확인할 수 없습니다.');
      }
      if (data.requiresHumanConfirmation !== true) {
        return fail('사람 확인이 필요한 설명인지 검증할 수 없습니다.');
      }
      if (!Array.isArray(event.evidence) || event.evidence.length === 0
        || !event.evidence.every((item) => validId(item?.id) && safeText(item?.text, 500))) {
        return fail('이 사건의 근거가 부족하거나 유효하지 않습니다.');
      }
      if (!Array.isArray(event.rules) || event.rules.length === 0
        || !event.rules.every((item) => validId(item?.id) && safeText(item?.text, 300))) {
        return fail('이 사건의 규칙을 확인할 수 없습니다.');
      }
      const evidence = new Map(event.evidence.map((item) => [item.id, item.text]));
      const ruleIds = new Set(event.rules.map((item) => item.id));
      const refsMatch = (ids) => Array.isArray(ids) && ids.length > 0
        && new Set(ids).size === ids.length && ids.every((id) => validId(id) && evidence.has(id));
      if (evidence.size !== event.evidence.length || ruleIds.size !== event.rules.length
        || !refsMatch(data.evidenceIds) || data.evidenceIds.length !== evidence.size) {
        return fail('근거 ID가 현재 사건의 근거와 일치하지 않거나 일부 근거가 누락되었습니다.');
      }
      if (!event.state || typeof event.state !== 'object' || Array.isArray(event.state)
        || !['access', 'session', 'device'].every((key) => typeof event.state[key] === 'string')) {
        return fail('사건의 접속·세션·기기 상태를 확인할 수 없습니다.');
      }
      if (!Array.isArray(event.supportedActions) || !Array.isArray(data.proposals)
        || data.proposals.length > 3 || !data.proposals.every((proposal) => proposal
          && validId(proposal.action) && event.supportedActions.includes(proposal.action)
          && safeText(proposal.reason, 500) && refsMatch(proposal.evidenceIds))) {
        return fail('조치 제안이나 해당 제안의 근거를 검증할 수 없습니다.');
      }

      root.setAttribute('data-student-explanation-event', event.id);
      addText(root, 'h3', 'AI 설명(참고용)');
      show(`사건 ID: ${event.id}`);
      show(`AI 요약: ${data.summary}`);
      if (typeof checkedAt === 'string' && checkedAt.length <= 64
        && /^\d{4}-\d{2}-\d{2}T/.test(checkedAt) && !Number.isNaN(Date.parse(checkedAt))) {
        show(`설명 확인 시각: ${checkedAt}`);
      }
      show('AI 설명은 참고 정보입니다. 사실 판단은 보안 기록의 근거와 연동 시스템 상태를 기준으로 합니다.');

      addText(root, 'h4', '인용한 근거');
      const evidenceList = document.createElement('ul');
      for (const id of data.evidenceIds) {
        addText(evidenceList, 'li', `${id} — ${evidence.get(id)}`);
      }
      root.append(evidenceList);

      addText(root, 'h4', '적용된 규칙');
      const ruleList = document.createElement('ul');
      for (const rule of event.rules) {
        addText(ruleList, 'li', `${rule.id} — ${rule.text}`);
      }
      root.append(ruleList);

      addText(root, 'h4', '확인할 수 없는 상태');
      const names = { access: '접속', session: '세션', device: '기기' };
      const unknown = Object.keys(names).filter((key) => event.state[key] === 'unknown');
      if (unknown.length === 0) {
        show('없음');
      } else {
        const stateList = document.createElement('ul');
        for (const key of unknown) {
          addText(stateList, 'li', `${names[key]}: 확인 불가(unknown)`);
        }
        root.append(stateList);
      }

      addText(root, 'h4', '조치 제안');
      if (data.proposals.length === 0) {
        show(event.supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 이 사건에 대해 제안한 조치가 없습니다.');
      } else {
        const proposalList = document.createElement('ul');
        for (const proposal of data.proposals) {
          const item = document.createElement('li');
          addText(item, 'p', `조치: ${proposal.action} · 이유: ${proposal.reason}`);
          addText(item, 'p', `근거 ID: ${proposal.evidenceIds.join(', ')}`);
          addText(item, 'p', '사람 확인이 필요하며 실행되지 않았습니다.');
          proposalList.append(item);
        }
        root.append(proposalList);
      }
      show('이 화면의 AI 설명과 제안만으로는 보안 조치가 실행되지 않습니다.');
      return root;
    },
    renderAction({
      status = 'idle', event = null, actionId = null, target = null,
      receipt = null, observation = null, message = null,
      confirmationExpiresAt = null, error = null,
    } = {}) {
      // 매 호출마다 새 DOM을 만들어 이전 사건·요청·결과를 남기지 않는다.
      // 제공 화면이 요청과 사람 확인을 담당한다. 학생 함수는 표시만 한다.
      const root = document.createElement('section');
      root.setAttribute('aria-live', 'polite');
      const addText = (tag, value) => {
        const node = document.createElement(tag);
        node.textContent = value;
        root.append(node);
        return node;
      };
      const hasValue = (value) => (typeof value === 'string' && value.trim() !== '')
        || (typeof value === 'number' && Number.isFinite(value));
      const safeMessage = (value) => {
        if (typeof value !== 'string' || !value.trim() || value.length > 500
          || /(?:\bBearer\s+\S+|sk-(?:on-|proj-|ant-)?[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|authorization|password|passwd|secret|token|비밀번호|토큰)\s*[:=]\s*\S+)/i.test(value)) {
          return '안전하게 표시할 수 있는 상세 메시지가 없습니다.';
        }
        return value;
      };
      const eventId = hasValue(event?.id) ? String(event.id) : null;
      const currentAction = hasValue(actionId) ? String(actionId) : null;
      const requestId = hasValue(receipt?.requestId) ? String(receipt.requestId) : null;
      const receiptId = hasValue(receipt?.receiptId) ? String(receipt.receiptId) : null;
      const observedAt = hasValue(observation?.observedAt) ? String(observation.observedAt) : null;

      // 받은 영수증이 현재 사건·조치와 다르면 결과를 현재 조치의 성과로 연결하지 않는다.
      const eventMismatch = hasValue(receipt?.eventId) && eventId !== null
        && String(receipt.eventId) !== eventId;
      const actionMismatch = hasValue(receipt?.actionId) && currentAction !== null
        && String(receipt.actionId) !== currentAction;
      const targetMismatch = hasValue(receipt?.target?.id) && hasValue(target?.id)
        && (String(receipt.target.id) !== String(target.id)
          || receipt.target.generation !== target.generation);
      const mismatch = eventMismatch || actionMismatch || targetMismatch;
      if (eventId !== null && !mismatch) {
        root.setAttribute('data-student-action-event', eventId);
      }
      if (requestId !== null && !mismatch) {
        root.setAttribute('data-student-action-request', requestId);
      }

      addText('h3', '보안 조치 요청 상태');
      const observedSuccess = status === 'succeeded'
        && observation?.effectApplied === true
        && receiptId !== null
        && observedAt !== null
        && !Number.isNaN(Date.parse(observedAt))
        && !mismatch;
      const statusText = {
        idle: '아직 미실행(idle). 조치 제안만으로 실행되지 않습니다.',
        loading: '조치 준비 또는 원천 결과 조회 중(loading). 처리 결과는 아직 확인되지 않았습니다.',
        prepared: '준비됨·미실행(prepared). 대상과 조치를 확인하고 사람이 별도로 집행을 승인해야 합니다.',
        executing: '서버에 전달 중(executing). 요청 처리 및 실제 효과는 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending). 접수 응답(ACK)은 실행 성공이나 실제 효과 확인이 아닙니다.',
        succeeded: observedSuccess
          ? '효과 확인(succeeded). 연동 시스템의 실제 효과 관측값을 확인했습니다.'
          : '결과 불명(unknown). succeeded 응답만으로 실제 효과를 확인할 수 없습니다.',
        denied: '연동 시스템이 요청을 거절했습니다(denied). 실제 효과가 확인된 상태가 아닙니다.',
        failed: '연동 시스템의 조치 처리에 실패했습니다(failed). 실제 효과가 확인된 상태가 아닙니다.',
        unknown: '결과 불명(unknown). 성공이나 효과 없음 어느 쪽으로도 판단하지 마세요.',
        expired: '사람 확인 기한 만료(expired). 다시 조치를 준비하고 대상을 확인하세요.',
        error: '요청이 처리되지 않았습니다(error). 오류 정보를 확인하세요.',
      };
      addText('p', mismatch
        ? '결과 불명(unknown). 현재 사건·조치·대상과 요청 영수증이 일치하지 않습니다.'
        : (Object.hasOwn(statusText, status) ? statusText[status] : '결과 불명(unknown). 알 수 없는 조치 상태입니다.'));

      if (eventId !== null) addText('p', `현재 사건 ID(event.id): ${eventId}`);
      if (Array.isArray(event?.evidence)) {
        for (const item of event.evidence) {
          if (hasValue(item?.id)) addText('p', `현재 사건 근거 ID: ${String(item.id)}`);
        }
      }
      if (currentAction !== null) addText('p', `요청 조치 ID(actionId): ${currentAction}`);
      if (hasValue(target?.id)) addText('p', `실제 대상 ID(target.id): ${String(target.id)}`);
      if (hasValue(target?.generation)) addText('p', `대상 세대(target.generation): ${String(target.generation)}`);
      if (hasValue(confirmationExpiresAt)) {
        addText('p', `사람 확인 기한(confirmationExpiresAt): ${String(confirmationExpiresAt)}`);
      }
      if (requestId !== null) addText('p', `요청 ID(requestId): ${requestId}`);
      if (receiptId !== null) addText('p', `접수 영수증 ID(receiptId): ${receiptId}`);
      if (hasValue(receipt?.version)) addText('p', `결과 버전(version): ${String(receipt.version)}`);
      if (typeof receipt?.replayed === 'boolean') {
        addText('p', `응답 재사용 여부(replayed): ${receipt.replayed}. 이 값만으로 새로운 집행이나 효과를 판단하지 않습니다.`);
      }
      if (receipt?.superseded === true) {
        addText('p', '이전 결과가 최신 결과를 대신할 수 없습니다(superseded). 결과만 재조회하세요.');
      }

      if (observedSuccess) {
        addText('p', `원천 관측 시각(observation.observedAt): ${observedAt}`);
        addText('p', '실제 효과 관측값(effectApplied): true');
      } else if (status === 'succeeded' || status === 'unknown' || mismatch) {
        addText('p', '효과를 확인할 수 없습니다. 조치를 다시 집행하지 말고 제공 화면의 「원천 결과만 재조회」 기능을 이용하세요.');
      }
      if (status === 'pending' || status === 'executing' || status === 'loading') {
        addText('p', '이 단계에서는 실제 효과를 아직 확인하지 않았습니다.');
      }
      if (status === 'prepared') {
        addText('p', '사람 확인 및 집행은 제공 화면의 「대상과 조치를 확인했으며 집행합니다」에서만 진행합니다. 준비 자체는 실행이 아닙니다.');
      }
      if ((status === 'denied' || status === 'failed' || status === 'expired' || status === 'idle')
        && hasValue(message)) {
        addText('p', `상태 안내: ${safeMessage(message)}`);
      }
      if (status === 'error') {
        if (typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)) {
          addText('p', `오류 코드(error.code): ${error.code}`);
        }
        addText('p', `오류 메시지(error.message): ${safeMessage(error?.message)}`);
      }
      if (status === 'idle') {
        addText('p', '현재 기록의 지원 조치(supportedActions)가 비어 있으면 「조치 준비」 버튼이 표시되지 않는 것이 정상입니다.');
      }
      addText('p', '학생 화면에서는 조치 요청을 전송하지 않습니다. 「조치 화면 취소」는 서버에 이미 전달된 조치의 효과를 되돌리지 않습니다.');
      return root;
    },
  };
}
