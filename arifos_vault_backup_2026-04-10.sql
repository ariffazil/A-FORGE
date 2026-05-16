--
-- PostgreSQL database dump
--

\restrict uGhXzWvEuTu8lb6tZUDxC9bxp9hkLGXUO3Tybv9CrksCioB8yzwbLcgpvLHOL3n

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: get_last_chain_hash(); Type: FUNCTION; Schema: public; Owner: arifos_admin
--

CREATE FUNCTION public.get_last_chain_hash() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    last_hash VARCHAR(64);
BEGIN
    SELECT chain_hash INTO last_hash
    FROM vault_events
    ORDER BY id DESC
    LIMIT 1;
    
    RETURN COALESCE(last_hash, repeat('0', 64));
END;
$$;


ALTER FUNCTION public.get_last_chain_hash() OWNER TO arifos_admin;

--
-- Name: verify_chain_integrity(bigint); Type: FUNCTION; Schema: public; Owner: arifos_admin
--

CREATE FUNCTION public.verify_chain_integrity(start_id bigint DEFAULT 1) RETURNS TABLE(is_valid boolean, broken_at_id bigint, expected_hash character varying, actual_hash character varying, total_checked bigint)
    LANGUAGE plpgsql
    AS $$
DECLARE
    rec RECORD;
    expected_prev VARCHAR(64);
    check_count BIGINT := 0;
BEGIN
    expected_prev := repeat('0', 64);
    
    FOR rec IN 
        SELECT id, prev_hash, chain_hash
        FROM vault_events
        WHERE id >= start_id
        ORDER BY id
    LOOP
        check_count := check_count + 1;
        
        IF rec.prev_hash != expected_prev THEN
            RETURN QUERY SELECT 
                FALSE,
                rec.id,
                expected_prev,
                rec.prev_hash,
                check_count;
            RETURN;
        END IF;
        
        expected_prev := rec.chain_hash;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, NULL::BIGINT, NULL::VARCHAR, NULL::VARCHAR, check_count;
END;
$$;


ALTER FUNCTION public.verify_chain_integrity(start_id bigint) OWNER TO arifos_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    agent_id text,
    action text,
    hash text,
    metadata jsonb
);


ALTER TABLE public.audit_log OWNER TO arifos_admin;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO arifos_admin;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: vault_artifacts; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_artifacts (
    id bigint NOT NULL,
    artifact_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id bigint,
    session_id uuid,
    artifact_type character varying(64) NOT NULL,
    file_path character varying(512) NOT NULL,
    file_hash character varying(64) NOT NULL,
    file_size bigint,
    content_type character varying(128),
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vault_artifacts OWNER TO arifos_admin;

--
-- Name: vault_artifacts_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.vault_artifacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vault_artifacts_id_seq OWNER TO arifos_admin;

--
-- Name: vault_artifacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.vault_artifacts_id_seq OWNED BY public.vault_artifacts.id;


--
-- Name: vault_audit; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_audit (
    id integer NOT NULL,
    session_id text,
    stage text,
    verdict text,
    actor_id text,
    payload jsonb,
    hash text,
    created_at timestamp with time zone DEFAULT now(),
    ledger_id text,
    floor_scores jsonb,
    sha256_hash text
);


ALTER TABLE public.vault_audit OWNER TO arifos_admin;

--
-- Name: vault_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.vault_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vault_audit_id_seq OWNER TO arifos_admin;

--
-- Name: vault_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.vault_audit_id_seq OWNED BY public.vault_audit.id;


--
-- Name: vault_events; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_events (
    id bigint NOT NULL,
    event_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_type character varying(64) NOT NULL,
    session_id uuid NOT NULL,
    actor_id character varying(128) NOT NULL,
    stage character varying(32) NOT NULL,
    verdict character varying(32) NOT NULL,
    risk_tier character varying(16) DEFAULT 'medium'::character varying NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    merkle_leaf character varying(64) NOT NULL,
    prev_hash character varying(64) NOT NULL,
    chain_hash character varying(64) NOT NULL,
    signature character varying(256),
    signed_by character varying(128),
    sealed_at timestamp with time zone DEFAULT now() NOT NULL,
    is_superseded boolean DEFAULT false,
    superseded_by uuid
);


ALTER TABLE public.vault_events OWNER TO arifos_admin;

--
-- Name: vault_events_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.vault_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vault_events_id_seq OWNER TO arifos_admin;

--
-- Name: vault_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.vault_events_id_seq OWNED BY public.vault_events.id;


--
-- Name: vault_mirror_log; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_mirror_log (
    id bigint NOT NULL,
    event_id bigint,
    mirror_type character varying(32) DEFAULT 'filesystem'::character varying NOT NULL,
    mirror_status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    mirror_path character varying(512),
    error_message text,
    attempted_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


ALTER TABLE public.vault_mirror_log OWNER TO arifos_admin;

--
-- Name: vault_mirror_log_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.vault_mirror_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vault_mirror_log_id_seq OWNER TO arifos_admin;

--
-- Name: vault_mirror_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.vault_mirror_log_id_seq OWNED BY public.vault_mirror_log.id;


--
-- Name: vault_seals; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_seals (
    id bigint NOT NULL,
    seal_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tree_size bigint NOT NULL,
    merkle_root character varying(64) NOT NULL,
    prev_root character varying(64) NOT NULL,
    first_event_id bigint,
    last_event_id bigint,
    signature character varying(256) NOT NULL,
    signed_by character varying(128) DEFAULT '888_AUDITOR'::character varying NOT NULL,
    sealed_at timestamp with time zone DEFAULT now() NOT NULL,
    archive_path character varying(512)
);


ALTER TABLE public.vault_seals OWNER TO arifos_admin;

--
-- Name: vault_seals_id_seq; Type: SEQUENCE; Schema: public; Owner: arifos_admin
--

CREATE SEQUENCE public.vault_seals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vault_seals_id_seq OWNER TO arifos_admin;

--
-- Name: vault_seals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arifos_admin
--

ALTER SEQUENCE public.vault_seals_id_seq OWNED BY public.vault_seals.id;


--
-- Name: vault_sessions; Type: TABLE; Schema: public; Owner: arifos_admin
--

CREATE TABLE public.vault_sessions (
    session_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    parent_session_id uuid,
    actor_id character varying(128) NOT NULL,
    actor_type character varying(64) DEFAULT 'human'::character varying NOT NULL,
    model_name character varying(64),
    caller_info jsonb DEFAULT '{}'::jsonb,
    constitutional_context jsonb DEFAULT '{}'::jsonb,
    max_risk_tier character varying(16) DEFAULT 'medium'::character varying,
    pns_enabled boolean DEFAULT true,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    final_verdict character varying(32),
    event_count integer DEFAULT 0
);


ALTER TABLE public.vault_sessions OWNER TO arifos_admin;

--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: vault_artifacts id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_artifacts ALTER COLUMN id SET DEFAULT nextval('public.vault_artifacts_id_seq'::regclass);


--
-- Name: vault_audit id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_audit ALTER COLUMN id SET DEFAULT nextval('public.vault_audit_id_seq'::regclass);


--
-- Name: vault_events id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_events ALTER COLUMN id SET DEFAULT nextval('public.vault_events_id_seq'::regclass);


--
-- Name: vault_mirror_log id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_mirror_log ALTER COLUMN id SET DEFAULT nextval('public.vault_mirror_log_id_seq'::regclass);


--
-- Name: vault_seals id; Type: DEFAULT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_seals ALTER COLUMN id SET DEFAULT nextval('public.vault_seals_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.audit_log (id, "timestamp", agent_id, action, hash, metadata) FROM stdin;
\.


--
-- Data for Name: vault_artifacts; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_artifacts (id, artifact_id, event_id, session_id, artifact_type, file_path, file_hash, file_size, content_type, description, created_at) FROM stdin;
\.


--
-- Data for Name: vault_audit; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_audit (id, session_id, stage, verdict, actor_id, payload, hash, created_at, ledger_id, floor_scores, sha256_hash) FROM stdin;
1	session-pg-test-002	999_VAULT	SEAL	anonymous	{"summary": "Postgres write-through audit test", "telemetry": {}, "approved_by": "arif_sovereign"}	7e877579e41355c04d766e0a6ed9574f94a4f3ea79bf475344282da5e4f2d00d	2026-03-20 20:20:41.543124+00	LGR-BDBA44D897040B92	{"F1": "pass", "F5": "pass", "F9": "pass", "F12": "pass", "F13": "pass"}	7e877579e41355c04d766e0a6ed9574f94a4f3ea79bf475344282da5e4f2d00d
\.


--
-- Data for Name: vault_events; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_events (id, event_id, event_type, session_id, actor_id, stage, verdict, risk_tier, payload, merkle_leaf, prev_hash, chain_hash, signature, signed_by, sealed_at, is_superseded, superseded_by) FROM stdin;
30	3b8b8db4-31b4-4b35-95de-33d4016af5cf	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 0", "test_id": 0, "timestamp": "2026-04-02T09:25:41.405159+00:00"}	788902a16a51f9689c0e6754365b469065690327a2d371bf62f7f6f1babc11ee	0000000000000000000000000000000000000000000000000000000000000000	a664126b4ae837d44b0b2e84a9b2870289361a45ae3fd47a5c4a72ecc8fc4186	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
31	117292ff-aa33-48c0-a308-e1381c160f4f	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 1", "test_id": 1, "timestamp": "2026-04-02T09:25:41.405193+00:00"}	6e28f702fa200ccff0a9a090e58443213fe088d51be8390554f9ddacd6b9c418	a664126b4ae837d44b0b2e84a9b2870289361a45ae3fd47a5c4a72ecc8fc4186	6d5a75e8367d9acc83034cf6c8e530120e6f2620afdcc3dbd7a58f4f5cb9b80a	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
32	676770d4-f1ff-4284-9fd3-d5aeaa415c64	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 2", "test_id": 2, "timestamp": "2026-04-02T09:25:41.405203+00:00"}	18ef0b97ae62456b98f994bc14a78df52389b6f0415eb42140a18fee3ae61eb8	6d5a75e8367d9acc83034cf6c8e530120e6f2620afdcc3dbd7a58f4f5cb9b80a	caeb1eddaa003b4b23559d072a44333167e8ee4c2e507a06324f381274932109	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
33	b22b0d04-ab65-4b31-b2f0-167f4a7e8195	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 0", "test_id": 0, "timestamp": "2026-04-02T09:26:34.301435+00:00"}	2f371aae6bd7deee2a3a9af145de63a0a6dc7042f00a8427e254c85b7df7b0d4	caeb1eddaa003b4b23559d072a44333167e8ee4c2e507a06324f381274932109	756ace7b9be62e30af75e15abe11f64d361a6b5acab7309a84a77bf934619774	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
34	e3fb01d8-dbc9-4c5e-b61a-3e4ce45790e2	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 1", "test_id": 1, "timestamp": "2026-04-02T09:26:34.301483+00:00"}	6b449b5538c27d3c05c838d1df81f85cd4b322c0d6049d58f659234fec2b297b	756ace7b9be62e30af75e15abe11f64d361a6b5acab7309a84a77bf934619774	0b782d220401c69250fcf035601a74faa049952b1f785f147a19f4f4c00bc794	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
35	144a113e-e32e-4072-b6a9-e07f39e3072a	test_seal	87641c8c-ebb2-53e5-a400-d2637a181e60	test_agent	999_VAULT	SEAL	medium	{"message": "Test event 2", "test_id": 2, "timestamp": "2026-04-02T09:26:34.301493+00:00"}	19a6f4cffc7798aeed47622c60e2d2b26093dfab74ddf4483b09f1650a2dfdd0	0b782d220401c69250fcf035601a74faa049952b1f785f147a19f4f4c00bc794	a5a4d6c7fbdaf816d3b918ea59b6962666fe4ed48896a406a8e91e73b4151655	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
36	5e0c7741-bf95-43fb-bf7e-ac4bb0af5e57	kimi_config	a6c4fc8f-6950-51de-a9ae-2c519c465071	system	999_VAULT	CLAIM	medium	{"ts": "2026-04-02T08:38:10+00:00", "note": "F1-F9 safety baseline sealed. zkPC-style cryptographic attestation of Kimi CLI config integrity.", "epoch": "2026.04.02", "status": "SEALED", "symbol": "ΔΩΨ", "verdict": "CLAIM", "authority": "999 (A-VALIDATOR)", "component": "kimi-cli", "seal_name": "kimi-cli-config-epoch-2026.04.02", "seal_type": "config+hooks+audit", "event_type": "kimi_config", "seal_phrase": "DITEMPA BUKAN DIBERI", "sha256_root": "b5d157f6dc9bb2455c339b68db6565fd18239e4e44501693d5c195a116791abd", "files_sealed": {"hooks": 9, "config": 1, "skills": 1, "agents_md": 1, "audit_scripts": 4}, "manifest_path": "/root/VAULT999/seals/kimi-cli-config-epoch-2026.04.02.manifest", "constitutional_floors": ["F1", "F2", "F3", "F4", "F7", "F9", "F11", "F13"]}	92983c688562ffa1b7afd4e2ce44362d2f5bab1034008b2798d0595bb9d28577	a5a4d6c7fbdaf816d3b918ea59b6962666fe4ed48896a406a8e91e73b4151655	9b29ee3017204a9a6508aa2feccdcbad8a76d70123b7674bdf36b2fff662684f	\N	\N	2026-04-02 09:41:13.33267+00	f	\N
37	b4265053-3077-4705-bd46-e4dfb80838c8	genesis	79de24fb-179b-4b4a-94db-1311a1280fff	arif	000_GENESIS	SEAL	medium	{"note": "All data preserved. Contrast and meaning intact.", "time": "2026-04-02T09:41:13.340582+00:00"}	aeebad4a796fcc2e15dc4c6061b45ed9b373f26adfc798ca7d2d8cc58182718e	9b29ee3017204a9a6508aa2feccdcbad8a76d70123b7674bdf36b2fff662684f	fd23ccb58e2af73df5bdb053cca8dcb276bada8906bcc0208cb500bc0df8326c	\N	\N	2026-04-02 09:41:13.340722+00	f	\N
38	079223de-986a-4d47-952b-2a2916034e05	hardened_seal	5253ea7f-d3ab-4d0d-9fb4-58a86e380462	arif	999_VAULT	SEAL	medium	{"meaning": "The architect decides, the system executes.", "message": "All data is data. Intelligence emerges from contrast.", "architect": "arif"}	f249732f7153a75aef1670c3415142c0758caf1513f97c591b130cd88a250c46	fd23ccb58e2af73df5bdb053cca8dcb276bada8906bcc0208cb500bc0df8326c	909cebdbec50214cc01258d659ceab2a6ac9a487ae142d091b90c301289d2990	\N	\N	2026-04-02 09:42:33.319395+00	f	\N
\.


--
-- Data for Name: vault_mirror_log; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_mirror_log (id, event_id, mirror_type, mirror_status, mirror_path, error_message, attempted_at, completed_at) FROM stdin;
\.


--
-- Data for Name: vault_seals; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_seals (id, seal_id, tree_size, merkle_root, prev_root, first_event_id, last_event_id, signature, signed_by, sealed_at, archive_path) FROM stdin;
\.


--
-- Data for Name: vault_sessions; Type: TABLE DATA; Schema: public; Owner: arifos_admin
--

COPY public.vault_sessions (session_id, parent_session_id, actor_id, actor_type, model_name, caller_info, constitutional_context, max_risk_tier, pns_enabled, started_at, ended_at, final_verdict, event_count) FROM stdin;
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 1, false);


--
-- Name: vault_artifacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.vault_artifacts_id_seq', 1, false);


--
-- Name: vault_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.vault_audit_id_seq', 1, true);


--
-- Name: vault_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.vault_events_id_seq', 38, true);


--
-- Name: vault_mirror_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.vault_mirror_log_id_seq', 1, false);


--
-- Name: vault_seals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arifos_admin
--

SELECT pg_catalog.setval('public.vault_seals_id_seq', 1, false);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: vault_artifacts vault_artifacts_artifact_id_key; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_artifacts
    ADD CONSTRAINT vault_artifacts_artifact_id_key UNIQUE (artifact_id);


--
-- Name: vault_artifacts vault_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_artifacts
    ADD CONSTRAINT vault_artifacts_pkey PRIMARY KEY (id);


--
-- Name: vault_audit vault_audit_ledger_id_key; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_audit
    ADD CONSTRAINT vault_audit_ledger_id_key UNIQUE (ledger_id);


--
-- Name: vault_audit vault_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_audit
    ADD CONSTRAINT vault_audit_pkey PRIMARY KEY (id);


--
-- Name: vault_events vault_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_events
    ADD CONSTRAINT vault_events_event_id_key UNIQUE (event_id);


--
-- Name: vault_events vault_events_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_events
    ADD CONSTRAINT vault_events_pkey PRIMARY KEY (id);


--
-- Name: vault_mirror_log vault_mirror_log_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_mirror_log
    ADD CONSTRAINT vault_mirror_log_pkey PRIMARY KEY (id);


--
-- Name: vault_seals vault_seals_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_seals
    ADD CONSTRAINT vault_seals_pkey PRIMARY KEY (id);


--
-- Name: vault_seals vault_seals_seal_id_key; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_seals
    ADD CONSTRAINT vault_seals_seal_id_key UNIQUE (seal_id);


--
-- Name: vault_sessions vault_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_sessions
    ADD CONSTRAINT vault_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: idx_mirror_log_event; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_mirror_log_event ON public.vault_mirror_log USING btree (event_id);


--
-- Name: idx_mirror_log_status; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_mirror_log_status ON public.vault_mirror_log USING btree (mirror_status);


--
-- Name: idx_vault_artifacts_event; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_artifacts_event ON public.vault_artifacts USING btree (event_id);


--
-- Name: idx_vault_artifacts_session; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_artifacts_session ON public.vault_artifacts USING btree (session_id);


--
-- Name: idx_vault_artifacts_type; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_artifacts_type ON public.vault_artifacts USING btree (artifact_type);


--
-- Name: idx_vault_audit_session; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_audit_session ON public.vault_audit USING btree (session_id);


--
-- Name: idx_vault_audit_verdict; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_audit_verdict ON public.vault_audit USING btree (verdict);


--
-- Name: idx_vault_events_actor; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_actor ON public.vault_events USING btree (actor_id);


--
-- Name: idx_vault_events_chain; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_chain ON public.vault_events USING btree (chain_hash);


--
-- Name: idx_vault_events_chain_hash; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_chain_hash ON public.vault_events USING btree (chain_hash);


--
-- Name: idx_vault_events_sealed_at; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_sealed_at ON public.vault_events USING btree (sealed_at DESC);


--
-- Name: idx_vault_events_session; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_session ON public.vault_events USING btree (session_id);


--
-- Name: idx_vault_events_session_time; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_session_time ON public.vault_events USING btree (session_id, sealed_at DESC);


--
-- Name: idx_vault_events_time; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_time ON public.vault_events USING btree (sealed_at);


--
-- Name: idx_vault_events_type; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_type ON public.vault_events USING btree (event_type);


--
-- Name: idx_vault_events_verdict; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_events_verdict ON public.vault_events USING btree (verdict);


--
-- Name: idx_vault_seals_root; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_seals_root ON public.vault_seals USING btree (merkle_root);


--
-- Name: idx_vault_seals_time; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_seals_time ON public.vault_seals USING btree (sealed_at);


--
-- Name: idx_vault_sessions_actor; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_sessions_actor ON public.vault_sessions USING btree (actor_id);


--
-- Name: idx_vault_sessions_parent; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_sessions_parent ON public.vault_sessions USING btree (parent_session_id);


--
-- Name: idx_vault_sessions_time; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX idx_vault_sessions_time ON public.vault_sessions USING btree (started_at);


--
-- Name: vault_audit_session_idx; Type: INDEX; Schema: public; Owner: arifos_admin
--

CREATE INDEX vault_audit_session_idx ON public.vault_audit USING btree (session_id);


--
-- Name: vault_artifacts vault_artifacts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_artifacts
    ADD CONSTRAINT vault_artifacts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.vault_events(id) ON DELETE CASCADE;


--
-- Name: vault_artifacts vault_artifacts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_artifacts
    ADD CONSTRAINT vault_artifacts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.vault_sessions(session_id);


--
-- Name: vault_events vault_events_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_events
    ADD CONSTRAINT vault_events_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.vault_events(event_id);


--
-- Name: vault_mirror_log vault_mirror_log_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_mirror_log
    ADD CONSTRAINT vault_mirror_log_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.vault_events(id) ON DELETE CASCADE;


--
-- Name: vault_seals vault_seals_first_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_seals
    ADD CONSTRAINT vault_seals_first_event_id_fkey FOREIGN KEY (first_event_id) REFERENCES public.vault_events(id);


--
-- Name: vault_seals vault_seals_last_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_seals
    ADD CONSTRAINT vault_seals_last_event_id_fkey FOREIGN KEY (last_event_id) REFERENCES public.vault_events(id);


--
-- Name: vault_sessions vault_sessions_parent_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arifos_admin
--

ALTER TABLE ONLY public.vault_sessions
    ADD CONSTRAINT vault_sessions_parent_session_id_fkey FOREIGN KEY (parent_session_id) REFERENCES public.vault_sessions(session_id);


--
-- PostgreSQL database dump complete
--

\unrestrict uGhXzWvEuTu8lb6tZUDxC9bxp9hkLGXUO3Tybv9CrksCioB8yzwbLcgpvLHOL3n

