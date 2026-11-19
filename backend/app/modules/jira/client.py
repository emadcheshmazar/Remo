"""Jira Server / Data Center REST API v2 client.

Aligned with Atlassian Server docs:
https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
https://developer.atlassian.com/server/jira/platform/webhooks/

Verified against jirarnd.dariarnd.ir (Jira Server 8.22.x):
- Auth: Bearer PAT (8.14+) or Basic user:password
- Issues / search / transitions under /rest/api/2
- Webhooks under /rest/webhooks/1.0 (Jira ≤9); Jira 10 uses /rest/jira-webhook/1.0
"""
import asyncio
import base64
from typing import Any
from urllib.parse import quote

import httpx

from app.modules.jira.mapper import ISSUE_FIELDS

_FIELDS_QUERY = ",".join(ISSUE_FIELDS)
_SPRINT_FIELDS_QUERY = ",".join([*ISSUE_FIELDS, "sprint"])


class JiraError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)


class JiraClient:
    def __init__(
        self,
        base_url: str,
        auth_type: str,
        secret: str,
        username: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if auth_type == "basic":
            token = base64.b64encode(f"{username or ''}:{secret}".encode()).decode()
            headers["Authorization"] = f"Basic {token}"
        else:
            # Jira Server/DC Personal Access Token — Authorization: Bearer <PAT>
            headers["Authorization"] = f"Bearer {secret}"
        self._client_kwargs: dict[str, Any] = {
            "base_url": self.base_url,
            "headers": headers,
            "timeout": 30.0,
        }
        if transport is not None:
            self._client_kwargs["transport"] = transport
        self._http: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "JiraClient":
        self._http = httpx.AsyncClient(**self._client_kwargs)
        return self

    async def __aexit__(self, *exc: object) -> None:
        if self._http is not None:
            close = getattr(self._http, "aclose", None)
            if close is not None:
                await close()
            self._http = None

    async def _send(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        if self._http is None:
            raise RuntimeError("JiraClient must be used as an async context manager")
        last: httpx.Response | None = None
        for attempt in range(3):
            response = await self._http.request(method, path, **kwargs)
            if response.status_code == 429 or response.status_code >= 500:
                last = response
                await asyncio.sleep(0.3 * (attempt + 1))
                continue
            return response
        assert last is not None
        return last

    @staticmethod
    def _message(response: httpx.Response) -> str:
        try:
            body = response.json()
        except Exception:
            body = None
        if isinstance(body, dict):
            messages = body.get("errorMessages") or []
            errors = body.get("errors") or {}
            parts = [str(m) for m in messages]
            parts.extend(f"{key}: {value}" for key, value in errors.items())
            if parts:
                return "; ".join(parts)[:500]
        text = (response.text or "").strip()
        return text[:500] or f"Jira HTTP {response.status_code}"

    def _raise_for_status(self, response: httpx.Response) -> None:
        if response.status_code >= 400:
            raise JiraError(response.status_code, self._message(response))

    def _json(self, response: httpx.Response) -> Any:
        self._raise_for_status(response)
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def myself(self) -> dict:
        return await self._json_get("/rest/api/2/myself")

    async def server_info(self) -> dict:
        return await self._json_get("/rest/api/2/serverInfo")

    async def projects(self) -> list[dict]:
        data = await self._json_get("/rest/api/2/project")
        return data or []

    async def issue_types(self, project_key: str) -> dict:
        # Jira ≥8.4 preferred (createmeta mega-endpoint is deprecated / removed in 9+)
        key = quote(project_key, safe="")
        response = await self._send("GET", f"/rest/api/2/issue/createmeta/{key}/issuetypes")
        if response.status_code != 404:
            return self._json(response) or {}
        # Fallback for unusual 8.x configs
        legacy = await self._json_get(
            "/rest/api/2/issue/createmeta",
            params={"projectKeys": project_key, "expand": "projects.issuetypes"},
        )
        projects = (legacy or {}).get("projects") or []
        values: list[dict] = []
        for project in projects:
            for issue_type in project.get("issuetypes") or []:
                values.append(issue_type)
        return {"values": values, "total": len(values), "startAt": 0, "maxResults": len(values)}

    async def priorities(self) -> list[dict]:
        data = await self._json_get("/rest/api/2/priority")
        return data or []

    async def boards(self, project_key: str | None = None) -> list[dict]:
        values: list[dict] = []
        start_at = 0
        while True:
            params: dict[str, Any] = {"startAt": start_at, "maxResults": 50}
            if project_key:
                params["projectKeyOrId"] = project_key
            data = await self._json_get("/rest/agile/1.0/board", params=params)
            items = (data or {}).get("values") or []
            values.extend(items)
            start_at += len(items)
            total = int((data or {}).get("total") or start_at)
            if not items or start_at >= total:
                return values

    async def board_configuration(self, board_id: int) -> dict:
        return await self._json_get(f"/rest/agile/1.0/board/{int(board_id)}/configuration")

    async def status(self, status_id: str | int) -> dict:
        encoded = quote(str(status_id), safe="")
        return await self._json_get(f"/rest/api/2/status/{encoded}")

    async def sprints(self, board_id: int, state: str | None = None) -> list[dict]:
        values: list[dict] = []
        start_at = 0
        while True:
            params: dict[str, Any] = {"startAt": start_at, "maxResults": 50}
            if state:
                params["state"] = state
            data = await self._json_get(f"/rest/agile/1.0/board/{int(board_id)}/sprint", params=params)
            items = (data or {}).get("values") or []
            values.extend(items)
            start_at += len(items)
            total = int((data or {}).get("total") or start_at)
            if not items or start_at >= total:
                return values

    async def sprint_issues(self, sprint_id: int, start_at: int = 0, max_results: int = 50) -> dict:
        return await self._json_get(
            f"/rest/agile/1.0/sprint/{int(sprint_id)}/issue",
            params={"startAt": start_at, "maxResults": max_results, "fields": _SPRINT_FIELDS_QUERY},
        )

    async def board_columns(self, board_id: int) -> list[dict]:
        config = await self.board_configuration(board_id)
        columns: list[dict] = []
        for column in config.get("columnConfig", {}).get("columns") or config.get("columns") or []:
            status_ids: list[str] = []
            status_names: list[str] = []
            for raw_status in column.get("statuses") or []:
                status_id = str(raw_status.get("id") or "").strip()
                if not status_id:
                    continue
                status_ids.append(status_id)
                name = (raw_status.get("name") or "").strip()
                if not name:
                    try:
                        name = str((await self.status(status_id)).get("name") or "").strip()
                    except Exception:
                        name = ""
                if name:
                    status_names.append(name)
            columns.append(
                {
                    "name": str(column.get("name") or "").strip(),
                    "status_ids": status_ids,
                    "status_names": status_names,
                }
            )
        return [column for column in columns if column["name"]]

    async def _json_get(self, path: str, **kwargs: Any) -> Any:
        return self._json(await self._send("GET", path, **kwargs))

    async def search(self, jql: str, start_at: int = 0, max_results: int = 50) -> dict:
        # POST /rest/api/2/search — Server/DC uses startAt/maxResults/total pagination
        payload = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": max_results,
            "fields": list(ISSUE_FIELDS),
        }
        return self._json(await self._send("POST", "/rest/api/2/search", json=payload)) or {}

    async def get_issue(self, issue_id_or_key: str) -> dict:
        # GET /rest/api/2/issue/{issueIdOrKey}?fields=...
        encoded = quote(str(issue_id_or_key), safe="")
        return await self._json_get(
            f"/rest/api/2/issue/{encoded}",
            params={"fields": _FIELDS_QUERY},
        )

    async def create_issue(self, fields: dict) -> dict:
        return self._json(await self._send("POST", "/rest/api/2/issue", json={"fields": fields}))

    async def update_issue(self, issue_id_or_key: str, fields: dict) -> None:
        encoded = quote(str(issue_id_or_key), safe="")
        self._json(await self._send("PUT", f"/rest/api/2/issue/{encoded}", json={"fields": fields}))

    async def transitions(self, issue_id_or_key: str) -> list[dict]:
        encoded = quote(str(issue_id_or_key), safe="")
        data = await self._json_get(f"/rest/api/2/issue/{encoded}/transitions")
        return (data or {}).get("transitions") or []

    async def transition(self, issue_id_or_key: str, transition_id: str) -> None:
        encoded = quote(str(issue_id_or_key), safe="")
        self._json(
            await self._send(
                "POST",
                f"/rest/api/2/issue/{encoded}/transitions",
                json={"transition": {"id": str(transition_id)}},
            )
        )

    async def add_watcher(self, issue_id_or_key: str, username: str) -> None:
        # Body is a JSON string of the username, e.g. "jdoe"
        encoded = quote(str(issue_id_or_key), safe="")
        self._json(await self._send("POST", f"/rest/api/2/issue/{encoded}/watchers", json=username))

    async def add_remote_link(self, issue_id_or_key: str, url: str, title: str, global_id: str) -> None:
        encoded = quote(str(issue_id_or_key), safe="")
        body = {"globalId": global_id, "object": {"url": url, "title": title}}
        self._json(await self._send("POST", f"/rest/api/2/issue/{encoded}/remotelink", json=body))

    async def user_search(self, username: str) -> list[dict]:
        # Server/DC: ?username=  (Cloud uses ?query=)
        data = self._json(
            await self._send("GET", "/rest/api/2/user/search", params={"username": username, "maxResults": 20})
        )
        return data or []

    async def assignable_users(self, project_key: str, query: str = "", max_results: int = 1000) -> list[dict]:
        """People who can be assigned in a project — best source for team sync."""
        values: list[dict] = []
        start_at = 0
        page_size = min(max(max_results, 1), 1000)
        while start_at < max_results:
            params: dict[str, Any] = {
                "project": project_key,
                "username": query or "",
                "startAt": start_at,
                "maxResults": min(page_size, max_results - start_at),
            }
            data = self._json(
                await self._send("GET", "/rest/api/2/user/assignable/search", params=params)
            )
            batch = data or []
            if not isinstance(batch, list):
                batch = batch.get("values") or []
            values.extend(batch)
            if len(batch) < params["maxResults"]:
                break
            start_at += len(batch)
        return values

    async def register_webhook(self, *, name: str, url: str, events: list[str], jql: str) -> dict:
        # Jira ≤9 / Server 8.x
        classic = {
            "name": name,
            "url": url,
            "events": events,
            "filters": {"issue-related-events-section": jql},
            "excludeBody": False,
        }
        response = await self._send("POST", "/rest/webhooks/1.0/webhook", json=classic)
        if response.status_code == 404:
            # Jira 10+
            modern = {
                "name": name,
                "url": url,
                "events": events,
                "configuration": {
                    "FILTERS": jql,
                    "EXCLUDE_BODY": "false",
                    "DESCRIPTION": name,
                },
                "active": "true",
            }
            response = await self._send("POST", "/rest/jira-webhook/1.0/webhooks", json=modern)
        data = self._json(response)
        return data or {"ok": True}
