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
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
