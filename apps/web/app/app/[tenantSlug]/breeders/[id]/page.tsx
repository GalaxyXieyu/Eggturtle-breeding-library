'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getBreederFamilyTreeResponseSchema,
  getBreederResponseSchema,
  listBreederEventsResponseSchema,
  type Breeder,
  type BreederEvent,
  type BreederFamilyTree
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken } from '../../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';

type DetailState = {
  breeder: Breeder | null;
  events: BreederEvent[];
  tree: BreederFamilyTree | null;
};

type FamilyTreeNode = BreederFamilyTree['self'];
type RouterLike = {
  push: (href: string) => void;
};

export default function BreederDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; tenantSlug: string }>();
  const breederId = useMemo(() => params.id ?? '', [params.id]);
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null
  });

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug || !breederId) {
      setError('Missing tenantSlug or breeder id in route.');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [breederResponse, eventsResponse, treeResponse] = await Promise.all([
          apiRequest(`/breeders/${breederId}`, {
            responseSchema: getBreederResponseSchema
          }),
          apiRequest(`/breeders/${breederId}/events`, {
            responseSchema: listBreederEventsResponseSchema
          }),
          apiRequest(`/breeders/${breederId}/family-tree`, {
            responseSchema: getBreederFamilyTreeResponseSchema
          })
        ]);

        if (!isCancelled) {
          setData({
            breeder: breederResponse.breeder,
            events: eventsResponse.events,
            tree: treeResponse.tree
          });
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [breederId, router, tenantSlug]);

  return (
    <main>
      <h1>Breeder detail</h1>
      <p>Tenant: {tenantSlug || '(unknown)'}</p>

      {loading ? (
        <section className="card stack">
          <h2>Loading</h2>
          <p>Loading breeder, events, and family tree...</p>
        </section>
      ) : null}

      {!loading && data.breeder ? (
        <section className="card stack">
          <h2>{data.breeder.code}</h2>
          <p>{data.breeder.name ?? 'Unnamed breeder'}</p>
          <p>
            Series: {data.breeder.series?.code ?? 'Unknown'} / {data.breeder.series?.name ?? 'Unknown'}
          </p>
          <p>
            sex={data.breeder.sex ?? 'unknown'} / status={data.breeder.isActive ? 'active' : 'inactive'}
          </p>
          <p>{data.breeder.description ?? 'No description'}</p>
          <p>
            sireCode={data.breeder.sireCode ?? 'N/A'} / damCode={data.breeder.damCode ?? 'N/A'} / mateCode=
            {data.breeder.mateCode ?? 'N/A'}
          </p>
        </section>
      ) : null}

      {!loading && data.tree ? (
        <section className="card stack">
          <h2>Family tree (Milestone 1)</h2>
          <p>{data.tree.limitations}</p>

          <div className="card stack">
            <h2>Self</h2>
            {renderTreeNode(data.tree.self, tenantSlug, router)}
          </div>

          <div className="card stack">
            <h2>Sire</h2>
            {data.tree.sire ? renderTreeNode(data.tree.sire, tenantSlug, router) : <p>Not linked</p>}
            {data.tree.links.sire && !data.tree.links.sire.breeder ? (
              <p className="error">Code exists in record but target breeder not found: {data.tree.links.sire.code}</p>
            ) : null}
          </div>

          <div className="card stack">
            <h2>Dam</h2>
            {data.tree.dam ? renderTreeNode(data.tree.dam, tenantSlug, router) : <p>Not linked</p>}
            {data.tree.links.dam && !data.tree.links.dam.breeder ? (
              <p className="error">Code exists in record but target breeder not found: {data.tree.links.dam.code}</p>
            ) : null}
          </div>

          <div className="card stack">
            <h2>Mate</h2>
            {data.tree.mate ? renderTreeNode(data.tree.mate, tenantSlug, router) : <p>Not linked</p>}
            {data.tree.links.mate && !data.tree.links.mate.breeder ? (
              <p className="error">Code exists in record but target breeder not found: {data.tree.links.mate.code}</p>
            ) : null}
          </div>

          <div className="card stack">
            <h2>Children</h2>
            {data.tree.children.length === 0 ? <p>No direct children found.</p> : null}
            <ul className="stack list">
              {data.tree.children.map((child) => (
                <li key={child.id} className="row between">
                  <span>
                    {child.code} / {child.name ?? 'Unnamed breeder'} ({child.sex ?? 'unknown'})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/app/${tenantSlug}/breeders/${child.id}`);
                    }}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="card stack">
          <h2>Events</h2>
          {data.events.length === 0 ? <p>No events for this breeder yet.</p> : null}

          <ul className="stack list">
            {data.events.map((event) => (
              <li key={event.id} className="card stack">
                <p>
                  <strong>{event.eventType}</strong>
                </p>
                <p>{new Date(event.eventDate).toLocaleString('zh-CN')}</p>
                <p>{event.note ?? 'No note'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="row">
        <button
          type="button"
          onClick={() => {
            const nextPath = data.breeder
              ? `/app/${tenantSlug}/breeders?seriesId=${data.breeder.seriesId}`
              : `/app/${tenantSlug}/breeders`;
            router.push(nextPath);
          }}
        >
          Back to breeders
        </button>
        <button type="button" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
          Open series
        </button>
      </div>

      {error ? (
        <section className="card stack">
          <p className="error">{error}</p>
          <div className="row">
            <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
              Go to breeders list
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function renderTreeNode(node: FamilyTreeNode, tenantSlug: string, router: RouterLike) {
  return (
    <div className="row between">
      <span>
        {node.code} / {node.name ?? 'Unnamed breeder'} ({node.sex ?? 'unknown'})
      </span>
      <button type="button" onClick={() => router.push(`/app/${tenantSlug}/breeders/${node.id}`)}>
        Open
      </button>
    </div>
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
