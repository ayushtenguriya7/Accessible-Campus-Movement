#!/usr/bin/env node

/**
 * Smoke test suite for Accessible Campus Movement API.
 * Plain Node.js 18+ ES module using native fetch (no extra packages needed).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 \
 *   STUDENT_REG=11111111 STUDENT_PASS=student123 \
 *   STAFF_REG=22222222 STAFF_PASS=staff123 \
 *   node scripts/smoke-test.mjs
 *
 * Environment variables:
 *   BASE_URL      - Target server base URL (default: http://localhost:3000)
 *   STUDENT_REG   - Registration number for student account (e.g., 11111111 or 12412853)
 *   STUDENT_PASS  - Password for student account
 *   STAFF_REG     - Registration number for estate staff account (e.g., 22222222)
 *   STAFF_PASS    - Password for estate staff account
 *
 * Exit code:
 *   0 if all steps passed, 1 if any step failed.
 */

import process from 'node:process';

// ---------------------------------------------------------------------------
// Configuration & State
// ---------------------------------------------------------------------------
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const STUDENT_REG = process.env.STUDENT_REG;
const STUDENT_PASS = process.env.STUDENT_PASS;
const STAFF_REG = process.env.STAFF_REG;
const STAFF_PASS = process.env.STAFF_PASS;

let hasFailed = false;
let totalSteps = 0;
let passedSteps = 0;
let failedSteps = 0;

function recordPass(label, detail = '') {
  totalSteps++;
  passedSteps++;
  if (detail) {
    console.log(`PASS: ${label} (${detail})`);
  } else {
    console.log(`PASS: ${label}`);
  }
}

function recordFail(label, reason = '') {
  totalSteps++;
  failedSteps++;
  hasFailed = true;
  if (reason) {
    console.log(`FAIL: ${label} - ${reason}`);
  } else {
    console.log(`FAIL: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP & Cookie Helpers
// ---------------------------------------------------------------------------
function extractUserToken(response) {
  let cookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    cookies = response.headers.getSetCookie();
  } else {
    const raw = response.headers.get('set-cookie');
    if (raw) cookies = [raw];
  }

  for (const c of cookies) {
    const match = c.match(/(?:^|;\s*)user_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function apiRequest(path, { method = 'GET', body, token, headers = {} } = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const reqHeaders = { ...headers };

  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    reqHeaders['Cookie'] = `user_token=${token}`;
  }

  const payload =
    body !== undefined
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : undefined;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: payload,
    });
  } catch (netErr) {
    throw new Error(`Network error on ${method} ${url}: ${netErr.message}`);
  }

  const rawText = await res.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
    headers: res.headers,
    rawText,
  };
}

async function login(registrationNo, password) {
  const res = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { registrationNo, password },
  });

  const token = extractUserToken(res);
  return {
    status: res.status,
    token,
    data: res.data,
  };
}

function getKolkataToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Main Test Runner
// ---------------------------------------------------------------------------
async function runSmokeTests() {
  console.log(`Starting smoke tests against ${BASE_URL}...\n`);

  let studentToken = null;
  let staffToken = null;
  let buildingsList = [];
  let targetBuilding = null;
  let originalLiftsWorking = null;
  let createdReportId = null;
  let createdReport = null;
  let finalLiftsWorking = null;

  try {
    // -----------------------------------------------------------------------
    // Step 1: Logged out access
    // -----------------------------------------------------------------------
    try {
      const postLift = await apiRequest('/api/lift-reports', {
        method: 'POST',
        body: { buildingId: 1, liftNumber: 1, problem: 'Door not closing' },
      });
      const patchLift = await apiRequest('/api/lift-reports/1', {
        method: 'PATCH',
        body: { status: 'in_progress' },
      });
      const getAdmin = await apiRequest('/api/admin/barrier-reports');

      const step1Ok =
        postLift.status === 401 &&
        patchLift.status === 401 &&
        getAdmin.status === 401;

      if (step1Ok) {
        recordPass(
          'Step 1: Logged out endpoints return 401',
          'POST /api/lift-reports, PATCH /api/lift-reports/1, GET /api/admin/barrier-reports'
        );
      } else {
        recordFail(
          'Step 1: Logged out endpoints return 401',
          `POST /api/lift-reports got ${postLift.status}, PATCH /api/lift-reports/1 got ${patchLift.status}, GET /api/admin/barrier-reports got ${getAdmin.status}`
        );
      }
    } catch (err) {
      recordFail('Step 1: Logged out endpoints return 401', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 2: Student login and buildings check
    // -----------------------------------------------------------------------
    try {
      if (!STUDENT_REG || !STUDENT_PASS) {
        recordFail(
          'Step 2: Student login and buildings check',
          'Missing STUDENT_REG or STUDENT_PASS environment variables'
        );
      } else {
        const loginRes = await login(STUDENT_REG, STUDENT_PASS);
        studentToken = loginRes.token;

        if (loginRes.status !== 200 || !studentToken) {
          recordFail(
            'Step 2: Student login and buildings check',
            `Student login failed with status ${loginRes.status}`
          );
        } else {
          const buildingsRes = await apiRequest('/api/buildings', {
            token: studentToken,
          });

          if (buildingsRes.status !== 200) {
            recordFail(
              'Step 2: Student login and buildings check',
              `GET /api/buildings returned status ${buildingsRes.status}`
            );
          } else {
            const rawBuildings =
              buildingsRes.data?.buildings || buildingsRes.data;
            if (!Array.isArray(rawBuildings)) {
              recordFail(
                'Step 2: Student login and buildings check',
                'Response did not contain an array of buildings'
              );
            } else {
              buildingsList = rawBuildings;
              const countMatches = buildingsList.length === 34;
              const featuresMatch = buildingsList.every(
                (b) => Array.isArray(b.features) && b.features.length === 3
              );

              if (countMatches && featuresMatch) {
                recordPass(
                  'Step 2: Student login and buildings check',
                  '34 buildings returned, each with 3 features'
                );
              } else {
                const reasons = [];
                if (!countMatches) {
                  reasons.push(
                    `expected 34 buildings, got ${buildingsList.length}`
                  );
                }
                if (!featuresMatch) {
                  reasons.push(
                    'not all buildings have a features array with 3 items'
                  );
                }
                recordFail(
                  'Step 2: Student login and buildings check',
                  reasons.join('; ')
                );
              }
            }
          }
        }
      }
    } catch (err) {
      recordFail('Step 2: Student login and buildings check', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 3: Student forbidden from admin endpoints
    // -----------------------------------------------------------------------
    try {
      if (!studentToken) {
        recordFail(
          'Step 3: Student forbidden access (403)',
          'Skipped due to missing student token'
        );
      } else {
        const getAdminRes = await apiRequest('/api/admin/barrier-reports', {
          token: studentToken,
        });
        const patchLiftRes = await apiRequest('/api/lift-reports/1', {
          method: 'PATCH',
          body: { status: 'in_progress' },
          token: studentToken,
        });

        const step3Ok =
          getAdminRes.status === 403 && patchLiftRes.status === 403;
        if (step3Ok) {
          recordPass(
            'Step 3: Student forbidden access (403)',
            'GET /api/admin/barrier-reports and PATCH /api/lift-reports/1 returned 403'
          );
        } else {
          recordFail(
            'Step 3: Student forbidden access (403)',
            `GET /api/admin/barrier-reports got ${getAdminRes.status}, PATCH /api/lift-reports/1 got ${patchLiftRes.status}`
          );
        }
      }
    } catch (err) {
      recordFail('Step 3: Student forbidden access (403)', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 4: Pick building & report lift issue
    // -----------------------------------------------------------------------
    try {
      if (!studentToken) {
        recordFail(
          'Step 4: Student create lift report',
          'Skipped due to missing student token'
        );
      } else if (!Array.isArray(buildingsList) || buildingsList.length === 0) {
        recordFail(
          'Step 4: Student create lift report',
          'No buildings available from Step 2'
        );
      } else {
        const candidates = buildingsList.filter((b) => {
          const total = Number(b.liftsTotal ?? b.lifts_total ?? 0);
          const working = Number(b.liftsWorking ?? b.lifts_working ?? 0);
          return total > 0 && working > 0;
        });

        if (candidates.length === 0) {
          recordFail(
            'Step 4: Student create lift report',
            'No buildings with lifts_total > 0 and lifts_working > 0 found'
          );
        } else {
          let successResponse = null;
          let chosenBuilding = null;

          for (const candidate of candidates) {
            const postRes = await apiRequest('/api/lift-reports', {
              method: 'POST',
              body: {
                buildingId: candidate.id,
                liftNumber: 1,
                problem: 'Door not closing',
                floor: '2',
              },
              token: studentToken,
            });

            if (postRes.status === 201) {
              successResponse = postRes;
              chosenBuilding = candidate;
              break;
            } else if (postRes.status === 409) {
              // Lift 1 already has an open report in this candidate building, try next
              continue;
            }
          }

          if (!successResponse) {
            recordFail(
              'Step 4: Student create lift report',
              'Could not find a candidate building with lifts_working > 0 and no open lift 1 report (all returned 409)'
            );
          } else {
            targetBuilding = chosenBuilding;
            originalLiftsWorking = Number(
              targetBuilding.liftsWorking ?? targetBuilding.lifts_working ?? 0
            );
            createdReport = successResponse.data?.report;
            createdReportId = createdReport?.id;
            const returnedBuilding = successResponse.data?.building;

            const newLiftsWorking = Number(
              returnedBuilding?.liftsWorking ??
                returnedBuilding?.lifts_working ??
                -1
            );
            const decremented = newLiftsWorking === originalLiftsWorking - 1;

            const getKeys = Object.keys(targetBuilding).sort();
            const returnedKeys = returnedBuilding
              ? Object.keys(returnedBuilding).sort()
              : [];
            const keysMatch =
              JSON.stringify(getKeys) === JSON.stringify(returnedKeys);

            if (decremented && keysMatch) {
              recordPass(
                'Step 4: Student create lift report',
                `Building "${targetBuilding.name}" (id: ${targetBuilding.id}): lifts_working decremented from ${originalLiftsWorking} to ${newLiftsWorking}, keys match`
              );
            } else {
              const reasons = [];
              if (!decremented) {
                reasons.push(
                  `lifts_working not decremented by 1 (was ${originalLiftsWorking}, now ${newLiftsWorking})`
                );
              }
              if (!keysMatch) {
                reasons.push(
                  `keys mismatch: expected [${getKeys.join(', ')}], got [${returnedKeys.join(', ')}]`
                );
              }
              recordFail('Step 4: Student create lift report', reasons.join('; '));
            }
          }
        }
      }
    } catch (err) {
      recordFail('Step 4: Student create lift report', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 5: Duplicate and validation checks
    // -----------------------------------------------------------------------
    try {
      if (!studentToken || !targetBuilding) {
        recordFail(
          'Step 5: Lift report validation & duplicate checks',
          'Skipped due to missing target building or student token'
        );
      } else {
        // 5a: Duplicate POST returns 409
        const dupRes = await apiRequest('/api/lift-reports', {
          method: 'POST',
          body: {
            buildingId: targetBuilding.id,
            liftNumber: 1,
            problem: 'Door not closing',
            floor: '2',
          },
          token: studentToken,
        });

        // 5b: liftNumber above lifts_total returns 400
        const liftsTotal = Number(
          targetBuilding.liftsTotal ?? targetBuilding.lifts_total ?? 1
        );
        const aboveTotalRes = await apiRequest('/api/lift-reports', {
          method: 'POST',
          body: {
            buildingId: targetBuilding.id,
            liftNumber: liftsTotal + 10,
            problem: 'Door not closing',
            floor: '2',
          },
          token: studentToken,
        });

        // 5c: problem 'Hot' returns 400
        const invalidProblemRes = await apiRequest('/api/lift-reports', {
          method: 'POST',
          body: {
            buildingId: targetBuilding.id,
            liftNumber: 1,
            problem: 'Hot',
            floor: '2',
          },
          token: studentToken,
        });

        // 5d: missing liftNumber returns 400
        const missingLiftRes = await apiRequest('/api/lift-reports', {
          method: 'POST',
          body: {
            buildingId: targetBuilding.id,
            problem: 'Door not closing',
            floor: '2',
          },
          token: studentToken,
        });

        const step5Ok =
          dupRes.status === 409 &&
          aboveTotalRes.status === 400 &&
          invalidProblemRes.status === 400 &&
          missingLiftRes.status === 400;

        if (step5Ok) {
          recordPass(
            'Step 5: Lift report validation & duplicate checks',
            'Duplicate -> 409, liftNumber out of bounds -> 400, invalid problem -> 400, missing liftNumber -> 400'
          );
        } else {
          const failures = [];
          if (dupRes.status !== 409) {
            failures.push(`duplicate POST expected 409, got ${dupRes.status}`);
          }
          if (aboveTotalRes.status !== 400) {
            failures.push(
              `above lifts_total expected 400, got ${aboveTotalRes.status}`
            );
          }
          if (invalidProblemRes.status !== 400) {
            failures.push(
              `problem 'Hot' expected 400, got ${invalidProblemRes.status}`
            );
          }
          if (missingLiftRes.status !== 400) {
            failures.push(
              `missing liftNumber expected 400, got ${missingLiftRes.status}`
            );
          }
          recordFail(
            'Step 5: Lift report validation & duplicate checks',
            failures.join('; ')
          );
        }
      }
    } catch (err) {
      recordFail(
        'Step 5: Lift report validation & duplicate checks',
        err.message
      );
    }

    // -----------------------------------------------------------------------
    // Step 6: Staff login & admin search check
    // -----------------------------------------------------------------------
    try {
      if (!STAFF_REG || !STAFF_PASS) {
        recordFail(
          'Step 6: Staff login and admin search check',
          'Missing STAFF_REG or STAFF_PASS environment variables'
        );
      } else {
        const loginRes = await login(STAFF_REG, STAFF_PASS);
        staffToken = loginRes.token;

        if (loginRes.status !== 200 || !staffToken) {
          recordFail(
            'Step 6: Staff login and admin search check',
            `Staff login failed with status ${loginRes.status}`
          );
        } else if (!targetBuilding || !createdReportId) {
          recordFail(
            'Step 6: Staff login and admin search check',
            'No created lift report from Step 4 to search for'
          );
        } else {
          const searchRes = await apiRequest(
            `/api/admin/barrier-reports?search=${encodeURIComponent(targetBuilding.name)}`,
            { token: staffToken }
          );

          if (searchRes.status !== 200) {
            recordFail(
              'Step 6: Staff login and admin search check',
              `Admin search returned status ${searchRes.status}`
            );
          } else {
            const data = searchRes.data || {};
            const hasNumericTotal = typeof data.total === 'number';
            const hasNumericTotalPages = typeof data.totalPages === 'number';
            const countsValid =
              data.counts &&
              typeof data.counts.all === 'number' &&
              typeof data.counts.pending === 'number' &&
              typeof data.counts.in_progress === 'number' &&
              typeof data.counts.resolved === 'number';
            const kpisValid =
              data.kpis &&
              typeof data.kpis.total === 'number' &&
              typeof data.kpis.pending === 'number' &&
              typeof data.kpis.in_progress === 'number' &&
              typeof data.kpis.resolved === 'number';

            const reports = Array.isArray(data.reports) ? data.reports : [];
            const includesReport = reports.some(
              (r) =>
                r.source === 'lift' &&
                (r.id === createdReportId ||
                  r.key === `lift-${createdReportId}`)
            );

            if (
              hasNumericTotal &&
              hasNumericTotalPages &&
              countsValid &&
              kpisValid &&
              includesReport
            ) {
              recordPass(
                'Step 6: Staff login and admin search check',
                `Report found for "${targetBuilding.name}", numeric total/totalPages/counts/kpis verified`
              );
            } else {
              const failures = [];
              if (!hasNumericTotal) failures.push('total is not a number');
              if (!hasNumericTotalPages) {
                failures.push('totalPages is not a number');
              }
              if (!countsValid) {
                failures.push(
                  'counts does not have numeric all/pending/in_progress/resolved'
                );
              }
              if (!kpisValid) {
                failures.push(
                  'kpis does not have numeric total/pending/in_progress/resolved'
                );
              }
              if (!includesReport) {
                failures.push(
                  `new report (lift id ${createdReportId}) not found in search results`
                );
              }
              recordFail(
                'Step 6: Staff login and admin search check',
                failures.join('; ')
              );
            }
          }
        }
      }
    } catch (err) {
      recordFail('Step 6: Staff login and admin search check', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 7: Pagination check
    // -----------------------------------------------------------------------
    try {
      if (!staffToken) {
        recordFail(
          'Step 7: Admin pagination check',
          'Skipped due to missing staff token'
        );
      } else {
        const firstPageRes = await apiRequest(
          '/api/admin/barrier-reports?pageSize=10&page=1',
          { token: staffToken }
        );

        if (firstPageRes.status !== 200) {
          recordFail(
            'Step 7: Admin pagination check',
            `Failed to fetch page 1 (status ${firstPageRes.status})`
          );
        } else {
          const total = firstPageRes.data?.total;
          const totalPages = firstPageRes.data?.totalPages;

          if (typeof total !== 'number' || typeof totalPages !== 'number') {
            recordFail(
              'Step 7: Admin pagination check',
              'Response missing numeric total or totalPages'
            );
          } else {
            const allKeys = [];
            const duplicateKeys = [];
            const seenKeys = new Set();
            let pagingError = null;

            for (let p = 1; p <= totalPages; p++) {
              const pageRes =
                p === 1
                  ? firstPageRes
                  : await apiRequest(
                      `/api/admin/barrier-reports?pageSize=10&page=${p}`,
                      { token: staffToken }
                    );

              if (pageRes.status !== 200) {
                pagingError = `Failed to fetch page ${p} (status ${pageRes.status})`;
                break;
              }

              const reports = Array.isArray(pageRes.data?.reports)
                ? pageRes.data.reports
                : [];
              for (const rep of reports) {
                const key = rep.key;
                if (seenKeys.has(key)) {
                  duplicateKeys.push(key);
                } else {
                  seenKeys.add(key);
                }
                allKeys.push(key);
              }
            }

            if (pagingError) {
              recordFail('Step 7: Admin pagination check', pagingError);
            } else {
              const noDuplicates = duplicateKeys.length === 0;
              const sizeMatchesTotal = seenKeys.size === total;

              if (noDuplicates && sizeMatchesTotal) {
                recordPass(
                  'Step 7: Admin pagination check',
                  `Fetched ${totalPages} page(s), ${seenKeys.size} unique keys, total = ${total}, 0 duplicates`
                );
              } else {
                const failures = [];
                if (!noDuplicates) {
                  failures.push(
                    `found ${duplicateKeys.length} duplicate key(s): ${duplicateKeys.slice(0, 3).join(', ')}`
                  );
                }
                if (!sizeMatchesTotal) {
                  failures.push(
                    `union size ${seenKeys.size} does not equal total ${total}`
                  );
                }
                recordFail(
                  'Step 7: Admin pagination check',
                  failures.join('; ')
                );
              }
            }
          }
        }
      }
    } catch (err) {
      recordFail('Step 7: Admin pagination check', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 8: Filters verification
    // -----------------------------------------------------------------------
    try {
      if (!staffToken) {
        recordFail(
          'Step 8: Admin report filters',
          'Skipped due to missing staff token'
        );
      } else {
        const filterFailures = [];

        // 8a: problem=broken_lift
        const probRes = await apiRequest(
          '/api/admin/barrier-reports?problem=broken_lift',
          { token: staffToken }
        );
        if (probRes.status !== 200) {
          filterFailures.push(
            `problem=broken_lift returned status ${probRes.status}`
          );
        } else {
          const reports = probRes.data?.reports || [];
          const allBrokenLift =
            reports.length > 0 &&
            reports.every((r) => r.barrierType === 'broken_lift');
          if (!allBrokenLift && reports.length > 0) {
            filterFailures.push(
              "problem=broken_lift returned rows with barrierType !== 'broken_lift'"
            );
          }
        }

        // 8b: status=pending
        const statusRes = await apiRequest(
          '/api/admin/barrier-reports?status=pending',
          { token: staffToken }
        );
        if (statusRes.status !== 200) {
          filterFailures.push(
            `status=pending returned status ${statusRes.status}`
          );
        } else {
          const reports = statusRes.data?.reports || [];
          const allPending = reports.every((r) => r.status === 'pending');
          if (!allPending) {
            filterFailures.push(
              "status=pending returned rows with status !== 'pending'"
            );
          }
        }

        // 8c: search with '%'
        const searchPercentRes = await apiRequest(
          '/api/admin/barrier-reports?search=%25',
          { token: staffToken }
        );
        if (searchPercentRes.status !== 200) {
          filterFailures.push(
            `search='%' returned status ${searchPercentRes.status}`
          );
        } else {
          const total =
            searchPercentRes.data?.total ??
            searchPercentRes.data?.reports?.length;
          if (total !== 0) {
            filterFailures.push(`search='%' expected 0 rows, got ${total}`);
          }
        }

        // 8d: search with "' OR 1=1 --"
        const searchInjRes = await apiRequest(
          `/api/admin/barrier-reports?search=${encodeURIComponent("' OR 1=1 --")}`,
          { token: staffToken }
        );
        if (searchInjRes.status === 500) {
          filterFailures.push(
            "search=\"' OR 1=1 --\" caused a 500 server error"
          );
        } else if (searchInjRes.status !== 200) {
          filterFailures.push(
            `search=\"' OR 1=1 --\" returned status ${searchInjRes.status}`
          );
        } else {
          const total =
            searchInjRes.data?.total ?? searchInjRes.data?.reports?.length;
          if (total !== 0) {
            filterFailures.push(
              `search=\"' OR 1=1 --\" expected 0 rows, got ${total}`
            );
          }
        }

        // 8e: from after to returns 400
        const fromAfterToRes = await apiRequest(
          '/api/admin/barrier-reports?from=2026-12-01&to=2026-11-01',
          { token: staffToken }
        );
        if (fromAfterToRes.status !== 400) {
          filterFailures.push(
            `from after to expected status 400, got ${fromAfterToRes.status}`
          );
        }

        // 8f: pageSize=1000 falls back to 10
        const pageSizeRes = await apiRequest(
          '/api/admin/barrier-reports?pageSize=1000',
          { token: staffToken }
        );
        if (pageSizeRes.status !== 200 || pageSizeRes.data?.pageSize !== 10) {
          filterFailures.push(
            `pageSize=1000 expected fallback to 10 with status 200, got status ${pageSizeRes.status} (pageSize: ${pageSizeRes.data?.pageSize ?? 'N/A'})`
          );
        }

        // 8g: page=9999 returns the last page
        const page9999Res = await apiRequest(
          '/api/admin/barrier-reports?page=9999',
          { token: staffToken }
        );
        if (page9999Res.status !== 200) {
          filterFailures.push(
            `page=9999 returned status ${page9999Res.status}`
          );
        } else {
          const returnedPage = page9999Res.data?.page;
          const totalPages = page9999Res.data?.totalPages;
          if (returnedPage !== totalPages) {
            filterFailures.push(
              `page=9999 expected page === totalPages (${totalPages}), got page ${returnedPage}`
            );
          }
        }

        if (filterFailures.length === 0) {
          recordPass(
            'Step 8: Admin report filters',
            'All 7 filter assertions passed'
          );
        } else {
          recordFail('Step 8: Admin report filters', filterFailures.join('; '));
        }
      }
    } catch (err) {
      recordFail('Step 8: Admin report filters', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 9: Date filter for today (Asia/Kolkata) includes new report
    // -----------------------------------------------------------------------
    try {
      if (!staffToken || !createdReportId) {
        recordFail(
          'Step 9: Date filter for today (Asia/Kolkata)',
          'Skipped due to missing staff token or created report ID'
        );
      } else {
        const todayKolkata = getKolkataToday();
        let found = false;
        let currentPage = 1;
        let maxPages = 1;

        do {
          const dateRes = await apiRequest(
            `/api/admin/barrier-reports?from=${todayKolkata}&to=${todayKolkata}&pageSize=50&page=${currentPage}`,
            { token: staffToken }
          );

          if (dateRes.status !== 200) {
            break;
          }

          maxPages = dateRes.data?.totalPages || 1;
          const reports = Array.isArray(dateRes.data?.reports)
            ? dateRes.data.reports
            : [];
          found = reports.some(
            (r) =>
              r.source === 'lift' &&
              (r.id === createdReportId ||
                r.key === `lift-${createdReportId}`)
          );

          if (found) break;
          currentPage++;
        } while (currentPage <= maxPages);

        if (found) {
          recordPass(
            'Step 9: Date filter for today (Asia/Kolkata)',
            `Report lift-${createdReportId} included in from=${todayKolkata}&to=${todayKolkata}`
          );
        } else {
          recordFail(
            'Step 9: Date filter for today (Asia/Kolkata)',
            `Report lift-${createdReportId} not found in date filter from=${todayKolkata}&to=${todayKolkata}`
          );
        }
      }
    } catch (err) {
      recordFail(
        'Step 9: Date filter for today (Asia/Kolkata)',
        err.message
      );
    }

    // -----------------------------------------------------------------------
    // Step 10: Staff PATCH status transitions
    // -----------------------------------------------------------------------
    try {
      if (!staffToken || !createdReportId || originalLiftsWorking === null) {
        recordFail(
          'Step 10: Staff PATCH status transitions',
          'Skipped due to missing staff token, report ID, or original count'
        );
      } else {
        const step10Failures = [];

        // 10a: status 'in_progress' -> lifts_working unchanged
        const inProgRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'in_progress' },
            token: staffToken,
          }
        );
        if (inProgRes.status !== 200) {
          step10Failures.push(
            `PATCH in_progress returned status ${inProgRes.status}`
          );
        } else {
          const working = Number(
            inProgRes.data?.building?.liftsWorking ??
              inProgRes.data?.building?.lifts_working ??
              -1
          );
          const expected = originalLiftsWorking - 1;
          if (working !== expected) {
            step10Failures.push(
              `in_progress expected lifts_working ${expected}, got ${working}`
            );
          }
        }

        // 10b: status 'resolved' -> lifts_working + 1 (back to original)
        const resolvedRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'resolved' },
            token: staffToken,
          }
        );
        if (resolvedRes.status !== 200) {
          step10Failures.push(
            `PATCH resolved returned status ${resolvedRes.status}`
          );
        } else {
          const working = Number(
            resolvedRes.data?.building?.liftsWorking ??
              resolvedRes.data?.building?.lifts_working ??
              -1
          );
          if (working !== originalLiftsWorking) {
            step10Failures.push(
              `resolved expected lifts_working ${originalLiftsWorking}, got ${working}`
            );
          }
        }

        // 10c: status 'pending' -> lifts_working - 1
        const pendingRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'pending' },
            token: staffToken,
          }
        );
        if (pendingRes.status !== 200) {
          step10Failures.push(
            `PATCH pending returned status ${pendingRes.status}`
          );
        } else {
          const working = Number(
            pendingRes.data?.building?.liftsWorking ??
              pendingRes.data?.building?.lifts_working ??
              -1
          );
          const expected = originalLiftsWorking - 1;
          if (working !== expected) {
            step10Failures.push(
              `pending expected lifts_working ${expected}, got ${working}`
            );
          }
        }

        // 10d: same status twice ('pending') returns 409
        const sameStatusRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'pending' },
            token: staffToken,
          }
        );
        if (sameStatusRes.status !== 409) {
          step10Failures.push(
            `same status twice expected 409, got ${sameStatusRes.status}`
          );
        }

        // 10e: invalid status returns 400
        const invalidStatusRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'non_existent_status' },
            token: staffToken,
          }
        );
        if (invalidStatusRes.status !== 400) {
          step10Failures.push(
            `invalid status expected 400, got ${invalidStatusRes.status}`
          );
        }

        if (step10Failures.length === 0) {
          recordPass(
            'Step 10: Staff PATCH status transitions',
            'in_progress, resolved, pending transitions and 409/400 errors verified'
          );
        } else {
          recordFail(
            'Step 10: Staff PATCH status transitions',
            step10Failures.join('; ')
          );
        }
      }
    } catch (err) {
      recordFail('Step 10: Staff PATCH status transitions', err.message);
    }

    // -----------------------------------------------------------------------
    // Step 11: Regression check for existing endpoints
    // -----------------------------------------------------------------------
    try {
      const tokenForExisting = studentToken || staffToken;
      const barriersRes = await apiRequest('/api/barriers', {
        token: tokenForExisting,
      });
      const buildingsRes = await apiRequest('/api/buildings', {
        token: tokenForExisting,
      });

      const barriersOk =
        barriersRes.status === 200 &&
        (Array.isArray(barriersRes.data) ||
          Array.isArray(barriersRes.data?.reports));
      const buildingsOk =
        buildingsRes.status === 200 &&
        (Array.isArray(buildingsRes.data) ||
          Array.isArray(buildingsRes.data?.buildings));

      if (barriersOk && buildingsOk) {
        recordPass(
          'Step 11: Existing endpoints regression check',
          'GET /api/barriers and GET /api/buildings return 200 with valid data structure'
        );
      } else {
        const failures = [];
        if (!barriersOk) {
          failures.push(
            `GET /api/barriers returned status ${barriersRes.status} (valid array/reports: false)`
          );
        }
        if (!buildingsOk) {
          failures.push(
            `GET /api/buildings returned status ${buildingsRes.status} (valid array/buildings: false)`
          );
        }
        recordFail(
          'Step 11: Existing endpoints regression check',
          failures.join('; ')
        );
      }
    } catch (err) {
      recordFail(
        'Step 11: Existing endpoints regression check',
        err.message
      );
    }
  } finally {
    // -----------------------------------------------------------------------
    // Step 12: Cleanup in finally block
    // -----------------------------------------------------------------------
    let cleanupSucceeded = false;

    try {
      if (createdReportId && staffToken) {
        const cleanRes = await apiRequest(
          `/api/lift-reports/${createdReportId}`,
          {
            method: 'PATCH',
            body: { status: 'resolved' },
            token: staffToken,
          }
        );

        if (cleanRes.status === 200) {
          finalLiftsWorking = Number(
            cleanRes.data?.building?.liftsWorking ??
              cleanRes.data?.building?.lifts_working
          );
          cleanupSucceeded = true;
        } else if (cleanRes.status === 409) {
          // Status was already resolved
          cleanupSucceeded = true;
          const tokenForCheck = studentToken || staffToken;
          const bRes = await apiRequest('/api/buildings', {
            token: tokenForCheck,
          });
          const raw = bRes.data?.buildings || bRes.data;
          if (Array.isArray(raw) && targetBuilding) {
            const b = raw.find((x) => x.id === targetBuilding.id);
            finalLiftsWorking = Number(b?.liftsWorking ?? b?.lifts_working);
          }
        } else {
          recordFail(
            'Step 12: Cleanup in finally',
            `Failed to resolve report ${createdReportId} (status ${cleanRes.status})`
          );
        }
      } else if (!createdReportId) {
        // No report was created to clean up
        cleanupSucceeded = true;
      } else if (!staffToken) {
        recordFail(
          'Step 12: Cleanup in finally',
          'Could not resolve report: staff token missing'
        );
      }

      if (cleanupSucceeded) {
        const restored =
          originalLiftsWorking === null ||
          finalLiftsWorking === null ||
          originalLiftsWorking === finalLiftsWorking;

        if (restored) {
          recordPass(
            'Step 12: Cleanup in finally',
            `Report resolved and lifts_working restored to original (${originalLiftsWorking ?? 'N/A'})`
          );
        } else {
          recordFail(
            'Step 12: Cleanup in finally',
            `lifts_working count mismatch (original: ${originalLiftsWorking}, final: ${finalLiftsWorking})`
          );
        }
      }
    } catch (cleanErr) {
      recordFail('Step 12: Cleanup in finally', cleanErr.message);
    } finally {
      console.log(
        `Original lifts_working: ${originalLiftsWorking !== null ? originalLiftsWorking : 'N/A'}`
      );
      console.log(
        `Final lifts_working: ${finalLiftsWorking !== null ? finalLiftsWorking : 'N/A'}`
      );
    }
  }

  // Summary
  console.log('\n========================================');
  console.log(
    `Smoke Test Complete: ${passedSteps}/${totalSteps} passed (${failedSteps} failed)`
  );
  console.log('========================================');

  process.exit(hasFailed ? 1 : 0);
}

runSmokeTests();

