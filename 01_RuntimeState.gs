/* ==============================\
   Shared runtime state initialisation
\============================== */

var SIGNIN_PERF_RUNTIME_ = (typeof SIGNIN_PERF_RUNTIME_ === 'object' && SIGNIN_PERF_RUNTIME_) || {};

if (!SIGNIN_PERF_RUNTIME_.attendanceByDate) {
  SIGNIN_PERF_RUNTIME_.attendanceByDate = {};
}
if (!SIGNIN_PERF_RUNTIME_.basketById) {
  SIGNIN_PERF_RUNTIME_.basketById = {};
}
if (!SIGNIN_PERF_RUNTIME_.basketLinesById) {
  SIGNIN_PERF_RUNTIME_.basketLinesById = {};
}
if (!SIGNIN_PERF_RUNTIME_.basketSummaryById) {
  SIGNIN_PERF_RUNTIME_.basketSummaryById = {};
}
